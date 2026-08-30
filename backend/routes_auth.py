"""Authentication routes: JWT email/password + Emergent Google session."""
import re
import httpx
from fastapi import APIRouter, HTTPException, Header, Depends
from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import timedelta

from core import (db, uid, now, now_iso, hash_password, verify_password, create_jwt,
                  get_current_user, clean, track, SESSION_DAYS, aware, resolve_token, _extract)

import os
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID")

router = APIRouter(prefix="/api/auth", tags=["auth"])


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    name: str = Field(min_length=1, max_length=80)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class SessionIn(BaseModel):
    id_token: str


ADMIN_EMAILS = {"admin@goodcause.ng", "faithfulgodwinc@gmail.com"}


def _user_out(u: dict) -> dict:
    return {
        "id": u["id"], "email": u.get("email"), "name": u.get("name"),
        "picture": u.get("picture"), "role": u.get("role", "donor"),
        "bio": u.get("bio"), "verified_organizer": u.get("verified_organizer", False),
        "created_at": u.get("created_at"),
    }


@router.post("/register")
async def register(body: RegisterIn):
    email = body.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=409, detail="An account with this email already exists.")
    is_admin = email in ADMIN_EMAILS
    user = {
        "id": uid("usr_"), "email": email, "name": body.name.strip(),
        "password_hash": hash_password(body.password), "picture": None,
        "role": "admin" if is_admin else "donor", "bio": None,
        "verified_organizer": is_admin,
        "auth_provider": "password", "created_at": now_iso(),
    }
    await db.users.insert_one(user)
    await track("signup", user["id"], {"provider": "password"})
    return {"token": create_jwt(user["id"]), "user": _user_out(user)}


@router.post("/login")
async def login(body: LoginIn):
    email = body.email.lower().strip()
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user or not user.get("password_hash") or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect email or password.")
    if email in ADMIN_EMAILS and user.get("role") != "admin":
        await db.users.update_one({"id": user["id"]}, {"$set": {"role": "admin", "verified_organizer": True}})
        user["role"] = "admin"
        user["verified_organizer"] = True
    await track("login", user["id"], {"provider": "password"})
    return {"token": create_jwt(user["id"]), "user": _user_out(user)}


@router.post("/session")
async def google_session(body: SessionIn):
    if not GOOGLE_CLIENT_ID or GOOGLE_CLIENT_ID == "your_google_web_client_id_here":
        raise HTTPException(status_code=501, detail="Google SSO requires production configuration.")
        
    try:
        idinfo = id_token.verify_oauth2_token(
            body.id_token, google_requests.Request(), GOOGLE_CLIENT_ID
        )
        
        email = idinfo.get("email")
        if not email:
            raise HTTPException(status_code=400, detail="Google token missing email.")
            
        email = email.lower().strip()
        name = idinfo.get("name", email.split("@")[0])
        picture = idinfo.get("picture")
        
        user = await db.users.find_one({"email": email}, {"_id": 0})
        
        if not user:
            # Register new user
            is_admin = email in ADMIN_EMAILS
            user = {
                "id": uid("usr_"), "email": email, "name": name,
                "password_hash": None, "picture": picture,
                "role": "admin" if is_admin else "donor", "bio": None,
                "verified_organizer": is_admin,
                "auth_provider": "google", "created_at": now_iso(),
            }
            await db.users.insert_one(user)
            await track("signup", user["id"], {"provider": "google"})
        else:
            # Update picture if missing or different, but not strictly necessary
            if picture and user.get("picture") != picture:
                await db.users.update_one({"id": user["id"]}, {"$set": {"picture": picture}})
                user["picture"] = picture
                
            if email in ADMIN_EMAILS and user.get("role") != "admin":
                await db.users.update_one({"id": user["id"]}, {"$set": {"role": "admin", "verified_organizer": True}})
                user["role"] = "admin"
                user["verified_organizer"] = True
                
            await track("login", user["id"], {"provider": "google"})
            
        return {"token": create_jwt(user["id"]), "user": _user_out(user)}
        
    except ValueError as e:
        raise HTTPException(status_code=401, detail=f"Invalid Google token: {str(e)}")


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return _user_out(user)


@router.post("/logout")
async def logout(authorization: Optional[str] = Header(None)):
    token = _extract(authorization)
    if token:
        await db.user_sessions.delete_many({"session_token": token})
    return {"ok": True}


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    bio: Optional[str] = None
    picture: Optional[str] = None


@router.patch("/profile")
async def update_profile(body: ProfileUpdate, user: dict = Depends(get_current_user)):
    updates = {k: v for k, v in body.dict().items() if v is not None}
    if updates:
        await db.users.update_one({"id": user["id"]}, {"$set": updates})
    u = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return _user_out(u)
