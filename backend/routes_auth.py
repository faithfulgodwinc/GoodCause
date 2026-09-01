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
import jwt
from jwt import PyJWKClient

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

class AppleSessionIn(BaseModel):
    id_token: str
    name: Optional[str] = None


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
    valid_client_ids = [c for c in [
        os.environ.get("GOOGLE_CLIENT_ID"),
        os.environ.get("GOOGLE_ANDROID_CLIENT_ID"),
        os.environ.get("GOOGLE_IOS_CLIENT_ID")
    ] if c and "your_" not in c]
    
    if not valid_client_ids:
        raise HTTPException(status_code=501, detail="Google SSO requires production configuration.")

    try:
        idinfo = None
        last_error = None
        for client_id in valid_client_ids:
            try:
                idinfo = id_token.verify_oauth2_token(
                    body.id_token, google_requests.Request(), client_id
                )
                break
            except ValueError as e:
                last_error = str(e)
                
        if not idinfo:
            raise ValueError(f"Token invalid or audience mismatch. {last_error}")
        
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

@router.post("/session/apple")
async def apple_session(body: AppleSessionIn):
    apple_client_id = os.environ.get("APPLE_CLIENT_ID")
    if not apple_client_id or "your_" in apple_client_id:
        raise HTTPException(status_code=501, detail="Apple SSO requires production configuration.")
    
    try:
        url = "https://appleid.apple.com/auth/keys"
        jwks_client = PyJWKClient(url)
        signing_key = jwks_client.get_signing_key_from_jwt(body.id_token)
        
        data = jwt.decode(
            body.id_token,
            signing_key.key,
            algorithms=["RS256"],
            audience=apple_client_id,
            issuer="https://appleid.apple.com"
        )
        
        email = data.get("email")
        if not email:
            raise HTTPException(status_code=400, detail="Apple token missing email.")
            
        email = email.lower().strip()
        
        user = await db.users.find_one({"email": email}, {"_id": 0})
        
        if not user:
            # Register new user
            is_admin = email in ADMIN_EMAILS
            display_name = body.name or email.split("@")[0]
            user = {
                "id": uid("usr_"), "email": email, "name": display_name,
                "password_hash": None, "picture": None,
                "role": "admin" if is_admin else "donor", "bio": None,
                "verified_organizer": is_admin,
                "auth_provider": "apple", "created_at": now_iso(),
            }
            await db.users.insert_one(user)
            await track("signup", user["id"], {"provider": "apple"})
        else:
            if email in ADMIN_EMAILS and user.get("role") != "admin":
                await db.users.update_one({"id": user["id"]}, {"$set": {"role": "admin", "verified_organizer": True}})
                user["role"] = "admin"
                user["verified_organizer"] = True
                
            await track("login", user["id"], {"provider": "apple"})
            
        return {"token": create_jwt(user["id"]), "user": _user_out(user)}
        
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid Apple token: {str(e)}")

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
