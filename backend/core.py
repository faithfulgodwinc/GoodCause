"""Shared core: db connection, security, auth dependencies, helpers."""
import os
import uuid
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional
from fastapi import Header, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

SESSION_DAYS = 7


# ---------- time / id helpers ----------
def now() -> datetime:
    return datetime.now(timezone.utc)


def now_iso() -> str:
    return now().isoformat()


def uid(prefix: str = "") -> str:
    return f"{prefix}{uuid.uuid4().hex[:16]}"


def aware(dt) -> Optional[datetime]:
    if dt is None:
        return None
    if isinstance(dt, str):
        try:
            dt = datetime.fromisoformat(dt)
        except ValueError:
            return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def clean(doc: Optional[dict]) -> Optional[dict]:
    if doc is None:
        return None
    doc.pop("_id", None)
    return doc


# ---------- password / token ----------
def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


def create_jwt(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "iat": int(now().timestamp()),
        "exp": int((now() + timedelta(days=SESSION_DAYS)).timestamp()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


async def resolve_token(token: str) -> Optional[str]:
    if not token:
        return None
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return payload.get("sub")
    except jwt.PyJWTError:
        pass
    sess = await db.user_sessions.find_one({"session_token": token})
    if sess:
        exp = aware(sess.get("expires_at"))
        if exp is None or exp > now():
            return sess["user_id"]
    return None


def _extract(authorization: Optional[str]) -> Optional[str]:
    if not authorization:
        return None
    parts = authorization.split(" ", 1)
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1].strip()
    return authorization.strip()


async def _load_user(user_id: str) -> Optional[dict]:
    return clean(await db.users.find_one({"id": user_id}, {"_id": 0}))


async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    token = _extract(authorization)
    user_id = await resolve_token(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Please sign in to continue.")
    user = await _load_user(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="Please sign in to continue.")
    return user


async def get_current_user_optional(authorization: Optional[str] = Header(None)) -> Optional[dict]:
    token = _extract(authorization)
    if not token:
        return None
    user_id = await resolve_token(token)
    if not user_id:
        return None
    return await _load_user(user_id)


async def require_admin(authorization: Optional[str] = Header(None)) -> dict:
    user = await get_current_user(authorization)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admins only.")
    return user


def public_user(user: Optional[dict]) -> Optional[dict]:
    if not user:
        return None
    return {
        "id": user.get("id"),
        "name": user.get("name"),
        "picture": user.get("picture"),
        "role": user.get("role", "donor"),
        "bio": user.get("bio"),
        "verified_organizer": user.get("verified_organizer", False),
    }


# ---------- notifications / analytics ----------
async def notify(user_id: str, ntype: str, title: str, body: str, campaign_id: Optional[str] = None):
    if not user_id:
        return
    await db.notifications.insert_one({
        "id": uid("ntf_"),
        "user_id": user_id,
        "type": ntype,
        "title": title,
        "body": body,
        "campaign_id": campaign_id,
        "read": False,
        "created_at": now_iso(),
    })


async def track(event: str, user_id: Optional[str] = None, props: Optional[dict] = None):
    await db.analytics_events.insert_one({
        "id": uid("evt_"),
        "event": event,
        "user_id": user_id,
        "props": props or {},
        "created_at": now_iso(),
    })


# ---------- campaign serialization ----------
CAMPAIGN_PUBLIC_STATUSES = {"LIVE", "COMPLETED", "PAUSED"}


def campaign_percent(raised: int, goal: int) -> int:
    if goal <= 0:
        return 0
    return min(100, int(round(raised * 100 / goal)))


async def serialize_campaign(doc: dict, viewer: Optional[dict] = None, detail: bool = False) -> dict:
    organizer = await db.users.find_one({"id": doc.get("organizer_id")}, {"_id": 0})
    raised = doc.get("raised_kobo", 0)
    goal = doc.get("goal_kobo", 0)
    out = {
        "id": doc["id"],
        "title": doc.get("title"),
        "summary": doc.get("summary"),
        "category_id": doc.get("category_id"),
        "category_name": doc.get("category_name"),
        "cover_image": doc.get("cover_image"),
        "goal_kobo": goal,
        "raised_kobo": raised,
        "currency": doc.get("currency", "NGN"),
        "percent": campaign_percent(raised, goal),
        "supporters_count": doc.get("supporters_count", 0),
        "updates_count": doc.get("updates_count", 0),
        "status": doc.get("status"),
        "verification_status": (doc.get("verification") or {}).get("status", "PENDING"),
        "featured": doc.get("featured", False),
        "urgent": doc.get("urgent", False),
        "deadline": doc.get("deadline"),
        "location": doc.get("location"),
        "created_at": doc.get("created_at"),
        "published_at": doc.get("published_at"),
        "organizer": public_user(organizer),
    }
    if detail:
        out.update({
            "story": doc.get("story"),
            "gallery": doc.get("gallery", []),
            "budget": doc.get("budget", []),
            "beneficiary": doc.get("beneficiary"),
            "verification": doc.get("verification"),
            "milestones_reached": doc.get("milestones_reached", []),
        })
        if viewer:
            out["is_following"] = bool(await db.campaign_followers.find_one(
                {"campaign_id": doc["id"], "user_id": viewer["id"]}))
            out["is_saved"] = bool(await db.saved_campaigns.find_one(
                {"campaign_id": doc["id"], "user_id": viewer["id"]}))
            out["is_organizer"] = doc.get("organizer_id") == viewer["id"]
        else:
            out["is_following"] = False
            out["is_saved"] = False
            out["is_organizer"] = False
    return out
