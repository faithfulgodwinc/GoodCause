"""Circles (community groups) and notifications."""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional
import secrets

from core import db, uid, now_iso, get_current_user, serialize_campaign, track

router = APIRouter(prefix="/api", tags=["social"])


class CircleIn(BaseModel):
    name: str = Field(min_length=2, max_length=60)
    description: Optional[str] = Field(default="", max_length=280)
    cover_image: Optional[str] = None


class JoinIn(BaseModel):
    invite_code: str


async def _circle_out(c: dict, user_id: Optional[str] = None) -> dict:
    members = await db.circle_members.count_documents({"circle_id": c["id"]})
    is_member = bool(user_id and await db.circle_members.find_one(
        {"circle_id": c["id"], "user_id": user_id}))
    return {
        "id": c["id"], "name": c["name"], "description": c.get("description", ""),
        "cover_image": c.get("cover_image"), "invite_code": c["invite_code"],
        "members_count": members, "owner_id": c["owner_id"],
        "is_member": is_member, "created_at": c.get("created_at"),
    }


@router.get("/circles")
async def list_circles(user: dict = Depends(get_current_user)):
    memberships = await db.circle_members.find({"user_id": user["id"]}, {"_id": 0}).to_list(100)
    ids = [m["circle_id"] for m in memberships]
    mine = await db.circles.find({"id": {"$in": ids}}, {"_id": 0}).to_list(100)
    discover = await db.circles.find({"id": {"$nin": ids}}, {"_id": 0}).sort("created_at", -1).limit(20).to_list(20)
    return {
        "mine": [await _circle_out(c, user["id"]) for c in mine],
        "discover": [await _circle_out(c, user["id"]) for c in discover],
    }


@router.post("/circles")
async def create_circle(body: CircleIn, user: dict = Depends(get_current_user)):
    circle = {
        "id": uid("crc_"), "name": body.name.strip(), "description": body.description or "",
        "cover_image": body.cover_image, "owner_id": user["id"],
        "invite_code": secrets.token_hex(4).upper(), "created_at": now_iso(),
    }
    await db.circles.insert_one(circle)
    await db.circle_members.insert_one({
        "id": uid("cmb_"), "circle_id": circle["id"], "user_id": user["id"],
        "role": "owner", "created_at": now_iso()})
    await track("circle_created", user["id"], {"circle_id": circle["id"]})
    return await _circle_out(circle, user["id"])


@router.post("/circles/join")
async def join_circle(body: JoinIn, user: dict = Depends(get_current_user)):
    circle = await db.circles.find_one({"invite_code": body.invite_code.strip().upper()}, {"_id": 0})
    if not circle:
        raise HTTPException(status_code=404, detail="No circle found with that invite code.")
    await db.circle_members.update_one(
        {"circle_id": circle["id"], "user_id": user["id"]},
        {"$setOnInsert": {"id": uid("cmb_"), "circle_id": circle["id"],
                          "user_id": user["id"], "role": "member", "created_at": now_iso()}},
        upsert=True)
    await track("circle_joined", user["id"], {"circle_id": circle["id"]})
    return await _circle_out(circle, user["id"])


@router.get("/circles/{circle_id}")
async def get_circle(circle_id: str, user: dict = Depends(get_current_user)):
    circle = await db.circles.find_one({"id": circle_id}, {"_id": 0})
    if not circle:
        raise HTTPException(status_code=404, detail="Circle not found.")
    out = await _circle_out(circle, user["id"])
    # member supported campaigns
    members = await db.circle_members.find({"circle_id": circle_id}, {"_id": 0}).to_list(500)
    member_ids = [m["user_id"] for m in members]
    donations = await db.donations.find(
        {"donor_id": {"$in": member_ids}, "status": "paid"}, {"_id": 0}).to_list(500)
    total = sum(d["amount_kobo"] for d in donations)
    campaign_ids = list({d["campaign_id"] for d in donations})
    campaigns = []
    for cid in campaign_ids[:20]:
        c = await db.campaigns.find_one({"id": cid}, {"_id": 0})
        if c:
            campaigns.append(await serialize_campaign(c))
    out["total_contributed_kobo"] = total
    out["campaigns"] = campaigns
    member_users = []
    for mid in member_ids[:30]:
        mu = await db.users.find_one({"id": mid}, {"_id": 0})
        if mu:
            member_users.append({"id": mu["id"], "name": mu["name"], "picture": mu.get("picture")})
    out["members"] = member_users
    return out


# ---------- notifications ----------
@router.get("/notifications")
async def notifications(user: dict = Depends(get_current_user)):
    rows = await db.notifications.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).limit(100).to_list(100)
    unread = await db.notifications.count_documents({"user_id": user["id"], "read": False})
    return {"items": rows, "unread": unread}


@router.post("/notifications/{notification_id}/read")
async def read_notification(notification_id: str, user: dict = Depends(get_current_user)):
    await db.notifications.update_one(
        {"id": notification_id, "user_id": user["id"]}, {"$set": {"read": True}})
    return {"ok": True}


@router.post("/notifications/read-all")
async def read_all(user: dict = Depends(get_current_user)):
    await db.notifications.update_many({"user_id": user["id"]}, {"$set": {"read": True}})
    return {"ok": True}
