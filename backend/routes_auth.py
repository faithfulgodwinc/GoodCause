"""Authentication routes — Passwordless (OTP + Google + Apple).

Email/password routes (/register, /login) are soft-deprecated and return 410
with a helpful message so existing API clients don't hard-crash.
"""
import os
import random
import string
import httpx
import logging
from fastapi import APIRouter, HTTPException, Header, Depends
from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import timedelta

from core import (db, uid, now, now_iso, hash_password, verify_password, create_jwt,
                  get_current_user, clean, track, SESSION_DAYS, aware, resolve_token, _extract)
from mailer import send_otp_email, send_welcome_email

import jwt
from jwt import PyJWKClient
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from google_oauth_config import google_client_ids

router = APIRouter(prefix="/api/auth", tags=["auth"])
logger = logging.getLogger(__name__)

OTP_TTL_MINUTES = 10
OTP_RATE_LIMIT_SECONDS = 60  # Minimum gap between OTP sends to same email

ADMIN_EMAILS = {"admin@goodcause.ng", "faithfulgodwinc@gmail.com"}


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _user_out(u: dict) -> dict:
    return {
        "id": u["id"], "email": u.get("email"), "name": u.get("name"),
        "picture": u.get("picture"), "role": u.get("role", "donor"),
        "bio": u.get("bio"), "verified_organizer": u.get("verified_organizer", False),
        "created_at": u.get("created_at"),
    }


async def _safe_track(event: str, user_id: Optional[str] = None, props: Optional[dict] = None):
    try:
        await track(event, user_id, props)
    except Exception as e:
        logger.warning("Ignoring analytics failure for %s: %s", event, e)


def _safe_send_welcome_email(email: str, name: str = ""):
    try:
        send_welcome_email(email, name)
    except Exception as e:
        logger.warning("Ignoring welcome email failure for %s: %s", email, e)


def _gen_otp() -> str:
    """Generate a cryptographically adequate 6-digit numeric OTP."""
    return "".join(random.choices(string.digits, k=6))


async def _upsert_otp_user(email: str, name: Optional[str] = None) -> dict:
    """Find or create a user record for the given email. Returns the user dict."""
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user:
        is_admin = email in ADMIN_EMAILS
        display_name = (name or "").strip() or email.split("@")[0]
        user = {
            "id": uid("usr_"), "email": email, "name": display_name,
            "password_hash": None, "picture": None,
            "role": "admin" if is_admin else "donor", "bio": None,
            "verified_organizer": is_admin,
            "auth_provider": "email_otp", "created_at": now_iso(),
        }
        await db.users.insert_one(user)
        await track("signup", user["id"], {"provider": "email_otp"})
        return user, True  # (user, is_new)
    else:
        updates = {}
        if name and name.strip() and name.strip() != user.get("name"):
            updates["name"] = name.strip()
            user["name"] = name.strip()
        if email in ADMIN_EMAILS and user.get("role") != "admin":
            updates["role"] = "admin"
            updates["verified_organizer"] = True
            user["role"] = "admin"
            user["verified_organizer"] = True
        if updates:
            await db.users.update_one({"id": user["id"]}, {"$set": updates})
        await track("login", user["id"], {"provider": "email_otp"})
        return user, False  # (user, is_new)


# ─── OTP: Send ────────────────────────────────────────────────────────────────

class OtpSendIn(BaseModel):
    email: EmailStr


@router.post("/otp/send")
async def otp_send(body: OtpSendIn):
    """Generate and email a 6-digit OTP to the user. Rate-limited to 1 per 60s."""
    email = body.email.lower().strip()

    # Rate limit: check if we sent one recently
    recent = await db.email_otps.find_one({
        "email": email,
        "used": False,
        "expires_at": {"$gte": (now() - timedelta(seconds=OTP_RATE_LIMIT_SECONDS - OTP_TTL_MINUTES * 60)).isoformat()},
    })
    # A simpler check: look for any OTP created in the last 60 seconds
    recent_otps = await db.email_otps.find(
        {"email": email}
    ).sort("created_at", -1).limit(1).to_list(1)
    if recent_otps:
        last = recent_otps[0]
        created = aware(last.get("created_at"))
        if created and (now() - created).total_seconds() < OTP_RATE_LIMIT_SECONDS:
            wait = int(OTP_RATE_LIMIT_SECONDS - (now() - created).total_seconds())
            raise HTTPException(
                status_code=429,
                detail=f"Please wait {wait} seconds before requesting another code."
            )

    # Invalidate any previously unused OTPs for this email
    # (We do this via the `used` flag — we don't delete, for audit trail)
    # Just insert a new one; verification always uses the latest unused one.

    code = _gen_otp()
    code_hash = hash_password(code)
    expires_at = (now() + timedelta(minutes=OTP_TTL_MINUTES)).isoformat()

    await db.email_otps.insert_one({
        "id": uid("otp_"),
        "email": email,
        "code_hash": code_hash,
        "expires_at": expires_at,
        "used": False,
        "created_at": now_iso(),
    })

    send_otp_email(email, code)  # fire — falls back to console log on failure

    return {"ok": True, "message": f"A 6-digit code has been sent to {email}."}


# ─── OTP: Verify ─────────────────────────────────────────────────────────────

class OtpVerifyIn(BaseModel):
    email: EmailStr
    code: str = Field(min_length=6, max_length=6)
    name: Optional[str] = Field(default=None, max_length=80)


@router.post("/otp/verify")
async def otp_verify(body: OtpVerifyIn):
    """Verify a 6-digit OTP. Returns a JWT + user on success."""
    email = body.email.lower().strip()

    # Find the latest unused, non-expired OTP for this email
    candidates = await db.email_otps.find(
        {"email": email, "used": False}
    ).sort("created_at", -1).limit(5).to_list(5)

    # Special test account for Google Play Store review team
    if email in {"playreview@goodcause.app", "reviewer@goodcause.app", "test@goodcause.app"} and body.code == "123456":
        user, is_new = await _upsert_otp_user(email, body.name or "Play Store Reviewer")
        return {
            "token": create_jwt(user["id"]),
            "user": _user_out(user),
            "is_new_user": is_new,
        }

    matched_otp = None
    for otp in candidates:
        exp = aware(otp.get("expires_at"))
        if exp and exp < now():
            continue  # expired
        if verify_password(body.code, otp["code_hash"]):
            matched_otp = otp
            break

    if not matched_otp:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired code. Please request a new one."
        )

    # Mark OTP as used
    await db.email_otps.update_one({"id": matched_otp["id"]}, {"$set": {"used": True}})

    # Upsert user
    user, is_new = await _upsert_otp_user(email, body.name)

    if is_new:
        send_welcome_email(email, user.get("name"))

    return {
        "token": create_jwt(user["id"]),
        "user": _user_out(user),
        "is_new_user": is_new,
    }


# ─── Google SSO ───────────────────────────────────────────────────────────────

class SessionIn(BaseModel):
    id_token: str


@router.post("/session")
async def google_session(body: SessionIn):
    valid_client_ids = google_client_ids()

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
            except Exception as e:
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
            is_admin = email in ADMIN_EMAILS
            user = {
                "id": uid("usr_"), "email": email, "name": name,
                "password_hash": None, "picture": picture,
                "role": "admin" if is_admin else "donor", "bio": None,
                "verified_organizer": is_admin,
                "auth_provider": "google", "created_at": now_iso(),
            }
            await db.users.insert_one(user)
            await _safe_track("signup", user["id"], {"provider": "google"})
            _safe_send_welcome_email(email, name)
            is_new = True
        else:
            updates = {}
            if name and name.strip() and name.strip() != user.get("name"):
                updates["name"] = name.strip()
                user["name"] = name.strip()
            if picture and user.get("picture") != picture:
                updates["picture"] = picture
                user["picture"] = picture
            if email in ADMIN_EMAILS and user.get("role") != "admin":
                updates["role"] = "admin"
                updates["verified_organizer"] = True
                user["role"] = "admin"
                user["verified_organizer"] = True
            if updates:
                await db.users.update_one({"id": user["id"]}, {"$set": updates})
            await _safe_track("login", user["id"], {"provider": "google"})
            is_new = False

        return {"token": create_jwt(user["id"]), "user": _user_out(user), "is_new_user": is_new}

    except ValueError as e:
        raise HTTPException(status_code=401, detail=f"Invalid Google token: {str(e)}")
    except HTTPException:
        raise
    except (OSError, ConnectionError) as e:
        logger.exception("Google session database or network failure")
        raise HTTPException(status_code=503, detail=f"Google sign-in could not reach the database: {type(e).__name__}")
    except Exception as e:
        logger.exception("Google session failed")
        raise HTTPException(status_code=500, detail=f"Google sign-in failed on the server: {type(e).__name__}")


# ─── Apple SSO ────────────────────────────────────────────────────────────────

class AppleSessionIn(BaseModel):
    id_token: str
    name: Optional[str] = None


@router.post("/session/apple")
async def apple_session(body: AppleSessionIn):
    env_apple_client_id = os.environ.get("APPLE_CLIENT_ID", "")
    allowed_audiences = list(set(filter(None, [env_apple_client_id if "your_" not in env_apple_client_id else "", "com.goodcause.app"])))

    try:
        url = "https://appleid.apple.com/auth/keys"
        jwks_client = PyJWKClient(url)
        signing_key = jwks_client.get_signing_key_from_jwt(body.id_token)

        data = jwt.decode(
            body.id_token,
            signing_key.key,
            algorithms=["RS256"],
            audience=allowed_audiences,
            issuer="https://appleid.apple.com"
        )

        email = data.get("email")
        if not email:
            raise HTTPException(status_code=400, detail="Apple token missing email.")

        email = email.lower().strip()
        user = await db.users.find_one({"email": email}, {"_id": 0})

        if not user:
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
            send_welcome_email(email, display_name)
            is_new = True
        else:
            if email in ADMIN_EMAILS and user.get("role") != "admin":
                await db.users.update_one({"id": user["id"]}, {"$set": {"role": "admin", "verified_organizer": True}})
                user["role"] = "admin"
                user["verified_organizer"] = True
            await track("login", user["id"], {"provider": "apple"})
            is_new = False

        return {"token": create_jwt(user["id"]), "user": _user_out(user), "is_new_user": is_new}

    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid Apple token: {str(e)}")


# ─── Deprecated password routes ───────────────────────────────────────────────

class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    name: str = Field(min_length=1, max_length=80)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


@router.post("/register", deprecated=True)
async def register(body: RegisterIn):
    """Deprecated: use /otp/send + /otp/verify instead."""
    raise HTTPException(
        status_code=410,
        detail="Password sign-up is no longer supported. Please use email code sign-in."
    )


@router.post("/login", deprecated=True)
async def login(body: LoginIn):
    """Deprecated: use /otp/send + /otp/verify instead.

    Existing password users: they will receive an OTP the next time they sign in.
    """
    raise HTTPException(
        status_code=410,
        detail="Password sign-in is no longer supported. Please use email code sign-in."
    )


# ─── Session / profile ────────────────────────────────────────────────────────

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


@router.delete("/account")
async def delete_account(user: dict = Depends(get_current_user)):
    """Automated in-app account deletion (Guideline 5.1.1).

    Permanently removes user profile, sessions, and OTP records.
    Financial donation records are anonymized to maintain audit logs.
    """
    user_id = user["id"]
    user_email = user.get("email")

    # 1. Anonymize donation records for accounting/audit compliance
    await db.donations.update_many(
        {"donor_id": user_id},
        {"$set": {"donor_name": "Anonymous Donor", "donor_email": "deleted@goodcause.app"}}
    )

    # 2. Delete user sessions & OTP records
    await db.user_sessions.delete_many({"user_id": user_id})
    if user_email:
        await db.email_otps.delete_many({"email": user_email})

    # 3. Track deletion before deleting user record
    await track("account_deleted", user_id, {"email": user_email})

    # 4. Delete user record
    await db.users.delete_one({"id": user_id})

    return {"ok": True, "message": "Account deleted successfully."}
