"""Authentication routes: JWT email/password + Emergent Google session."""
import re
import httpx
from fastapi import APIRouter, HTTPException, Header, Depends
from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import timedelta

from core import (db, uid, now, now_iso, hash_password, verify_password, create_jwt,
                  get_current_user, clean, track, SESSION_DAYS, aware, resolve_token, _extract)

router = APIRouter(prefix="/api/auth", tags=["auth"])

EMERGENT_SESSION_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    name: str = Field(min_length=1, max_length=80)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class SessionIn(BaseModel):
    session_id: str


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
    user = {
        "id": uid("usr_"), "email": email, "name": body.name.strip(),
        "password_hash": hash_password(body.password), "picture": None,
        "role": "donor", "bio": None, "verified_organizer": False,
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
    await track("login", user["id"], {"provider": "password"})
    return {"token": create_jwt(user["id"]), "user": _user_out(user)}


@router.post("/session")
async def google_session(body: SessionIn):
    async with httpx.AsyncClient(timeout=15) as http:
        try:
            resp = await http.get(EMERGENT_SESSION_URL, headers={"X-Session-ID": body.session_id})
        except Exception:
            raise HTTPException(status_code=401, detail="Could not complete Google sign-in.")
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Could not complete Google sign-in.")
    data = resp.json()
    email = (data.get("email") or "").lower().strip()
    if not email:
        raise HTTPException(status_code=401, detail="Could not complete Google sign-in.")

    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user = existing
        await db.users.update_one({"id": user["id"]}, {"$set": {
            "picture": data.get("picture") or user.get("picture"),
        }})
    else:
        user = {
            "id": uid("usr_"), "email": email, "name": data.get("name") or email.split("@")[0],
            "password_hash": None, "picture": data.get("picture"),
            "role": "donor", "bio": None, "verified_organizer": False,
            "auth_provider": "google", "created_at": now_iso(),
        }
        await db.users.insert_one(user)
        await track("signup", user["id"], {"provider": "google"})

    session_token = data.get("session_token") or uid("st_")
    await db.user_sessions.insert_one({
        "session_token": session_token, "user_id": user["id"],
        "expires_at": (now() + timedelta(days=SESSION_DAYS)).isoformat(),
        "created_at": now_iso(),
    })
    await track("login", user["id"], {"provider": "google"})
    return {"session_token": session_token, "token": session_token, "user": _user_out(user)}


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
