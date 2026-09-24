"""Campaigns, categories, updates, follow/save, reports, home feed."""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from typing import Optional, List

from core import (db, uid, now_iso, get_current_user, get_current_user_optional,
                  serialize_campaign, notify, track, clean)
import supabase_db

router = APIRouter(prefix="/api", tags=["campaigns"])

DRAFT_EDITABLE = {"DRAFT", "REQUIRES_MORE_INFORMATION", "REJECTED"}


# ---------- models ----------
class BudgetItem(BaseModel):
    item: str
    amount_kobo: int = Field(ge=0)


class Beneficiary(BaseModel):
    name: str
    relationship: str  # self / family / friend / community / organization
    type: str = "individual"
    note: Optional[str] = None


class CampaignIn(BaseModel):
    title: str = Field(min_length=3, max_length=120)
    summary: str = Field(default="", max_length=280)
    story: str = Field(default="")
    category_id: Optional[str] = None
    goal_kobo: int = Field(gt=0)
    cover_image: Optional[str] = None
    gallery: List[str] = []
    hero_video: Optional[str] = None
    budget: List[BudgetItem] = []
    beneficiary: Optional[Beneficiary] = None
    deadline: Optional[str] = None
    location: Optional[dict] = None


class CampaignPatch(BaseModel):
    title: Optional[str] = None
    summary: Optional[str] = None
    story: Optional[str] = None
    category_id: Optional[str] = None
    goal_kobo: Optional[int] = None
    cover_image: Optional[str] = None
    gallery: Optional[List[str]] = None
    hero_video: Optional[str] = None
    budget: Optional[List[BudgetItem]] = None
    beneficiary: Optional[Beneficiary] = None
    deadline: Optional[str] = None
    location: Optional[dict] = None


class UpdateIn(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    body: str = Field(min_length=1)
    image: Optional[str] = None
    milestone: Optional[int] = None


class ReportIn(BaseModel):
    reason: str
    details: Optional[str] = ""


# ---------- categories ----------
@router.get("/categories")
async def list_categories():
    cats = await db.categories.find({}, {"_id": 0}).sort("order", 1).to_list(100)
    return cats


# ---------- home feed ----------
async def _section(query: dict, sort, limit=8):
    docs = await db.campaigns.find(query, {"_id": 0}).sort(sort).limit(limit).to_list(limit)
    return [await serialize_campaign(d) for d in docs]


@router.get("/home")
async def home(user: Optional[dict] = Depends(get_current_user_optional)):
    live = {"status": {"$in": ["LIVE", "VERIFIED"]}}
    featured = await _section({**live, "featured": True}, [("published_at", -1)], 6)
    if not featured:
        featured = await _section(live, [("supporters_count", -1)], 6)
    urgent = await _section({**live, "urgent": True}, [("deadline", 1)], 8)
    recent_updates = await _section({**live, "updates_count": {"$gt": 0}}, [("last_update_at", -1)], 8)
    recommended = await _section(live, [("created_at", -1)], 10)
    all_campaigns = await _section(live, [("created_at", -1)], 20)

    # almost funded: 70-99%
    almost = []
    docs = await db.campaigns.find(live, {"_id": 0}).to_list(200)
    for d in docs:
        goal = d.get("goal_kobo", 0)
        raised = d.get("raised_kobo", 0)
        pct = (raised * 100 / goal) if goal else 0
        if 70 <= pct < 100:
            almost.append((pct, d))
    almost.sort(key=lambda x: -x[0])
    almost_funded = [await serialize_campaign(d) for _, d in almost[:8]]

    # Live Community Impact Metrics
    members_count = await db.users.count_documents({})
    causes_helped_count = await db.campaigns.count_documents({"status": {"$in": ["LIVE", "VERIFIED", "COMPLETED"]}})
    
    raised_row = await supabase_db.query_one(
        "SELECT COALESCE(SUM(raised_kobo), 0) AS total FROM campaigns"
    )
    given_kobo = int(raised_row["total"]) if raised_row else 0

    cats = await db.categories.find({}, {"_id": 0}).sort("order", 1).to_list(100)
    await track("app_open", user["id"] if user else None)
    return {
        "featured": featured, "urgent": urgent, "almost_funded": almost_funded,
        "recently_updated": recent_updates, "recommended": recommended,
        "all_campaigns": all_campaigns,
        "categories": cats,
        "greeting_name": user["name"].split(" ")[0] if user else None,
        "impact_metrics": {
            "members_count": members_count,
            "given_this_month_kobo": given_kobo,
            "causes_helped_count": causes_helped_count,
        },
    }


# ---------- list ----------
@router.get("/campaigns")
async def list_campaigns(
    section: Optional[str] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
    status: Optional[str] = None,
    mine: bool = False,
    skip: int = 0,
    limit: int = Query(20, le=50),
    user: Optional[dict] = Depends(get_current_user_optional),
):
    query: dict = {}
    if mine:
        if not user:
            raise HTTPException(status_code=401, detail="Please sign in to continue.")
        query["organizer_id"] = user["id"]
    else:
        query["status"] = {"$in": ["LIVE", "VERIFIED"]}
    if status:
        query["status"] = status
    if category and category != "__all" and category != "all":
        cat_doc = await db.categories.find_one({"id": category})
        if not cat_doc:
            cat_doc = await db.categories.find_one({"slug": category})
        query["category_id"] = cat_doc["id"] if cat_doc else category
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"summary": {"$regex": search, "$options": "i"}},
            {"story": {"$regex": search, "$options": "i"}},
        ]
    sort = [("created_at", -1)]
    if section == "urgent":
        sort = [("deadline", 1)]
    elif section == "supporters":
        sort = [("supporters_count", -1)]

    docs = await db.campaigns.find(query, {"_id": 0}).sort(sort).skip(skip).limit(limit).to_list(limit)
    items = [await serialize_campaign(d) for d in docs]
    if search:
        await track("campaign_view", user["id"] if user else None, {"search": search})
    return {"items": items, "skip": skip, "limit": limit}


# ---------- detail ----------
@router.get("/campaigns/{campaign_id}")
async def get_campaign(campaign_id: str, user: Optional[dict] = Depends(get_current_user_optional)):
    doc = await db.campaigns.find_one({"id": campaign_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Campaign not found.")
    is_owner = user and doc.get("organizer_id") == user["id"]
    is_admin = user and user.get("role") == "admin"
    if doc.get("status") not in {"LIVE", "COMPLETED", "PAUSED"} and not (is_owner or is_admin):
        raise HTTPException(status_code=404, detail="Campaign not found.")
    await track("campaign_view", user["id"] if user else None, {"campaign_id": campaign_id})
    return await serialize_campaign(doc, viewer=user, detail=True)


# ---------- create / patch ----------
@router.post("/campaigns")
async def create_campaign(body: CampaignIn, user: dict = Depends(get_current_user)):
    cat = None
    if body.category_id:
        cat = await db.categories.find_one({"id": body.category_id}, {"_id": 0})
    doc = {
        "id": uid("cmp_"),
        "organizer_id": user["id"],
        "title": body.title.strip(),
        "summary": body.summary.strip(),
        "story": body.story,
        "category_id": body.category_id,
        "category_name": cat["name"] if cat else None,
        "goal_kobo": body.goal_kobo,
        "raised_kobo": 0,
        "currency": "NGN",
        "cover_image": body.cover_image,
        "gallery": body.gallery,
        "hero_video": body.hero_video,
        "budget": [b.dict() for b in body.budget],
        "beneficiary": body.beneficiary.dict() if body.beneficiary else None,
        "deadline": body.deadline,
        "location": body.location or {"country": "NG"},
        "status": "DRAFT",
        "verification": {
            "status": "PENDING",
            "checks": {
                "identity": False, "beneficiary": False, "documents": False,
                "relationship": bool(body.beneficiary), "updates_enabled": True,
            },
        },
        "featured": False, "urgent": False,
        "supporters_count": 0, "updates_count": 0,
        "milestones_reached": [],
        "created_at": now_iso(), "updated_at": now_iso(),
        "published_at": None, "last_update_at": None,
    }
    await db.campaigns.insert_one(doc)
    await track("campaign_created", user["id"], {"campaign_id": doc["id"]})
    return await serialize_campaign(doc, viewer=user, detail=True)


@router.patch("/campaigns/{campaign_id}")
async def patch_campaign(campaign_id: str, body: CampaignPatch, user: dict = Depends(get_current_user)):
    doc = await db.campaigns.find_one({"id": campaign_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Campaign not found.")
    if doc["organizer_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="You can only edit your own campaigns.")
    if doc["status"] not in DRAFT_EDITABLE:
        raise HTTPException(status_code=400, detail="This campaign can no longer be edited.")
    updates = {}
    for k, v in body.dict().items():
        if v is None:
            continue
        if k == "budget":
            updates[k] = [i for i in v]
        elif k == "beneficiary":
            updates[k] = v
        else:
            updates[k] = v
    if "category_id" in updates:
        cat = await db.categories.find_one({"id": updates["category_id"]}, {"_id": 0})
        updates["category_name"] = cat["name"] if cat else None
    updates["updated_at"] = now_iso()
    await db.campaigns.update_one({"id": campaign_id}, {"$set": updates})
    doc = await db.campaigns.find_one({"id": campaign_id}, {"_id": 0})
    return await serialize_campaign(doc, viewer=user, detail=True)


@router.post("/campaigns/{campaign_id}/submit")
async def submit_campaign(campaign_id: str, user: dict = Depends(get_current_user)):
    doc = await db.campaigns.find_one({"id": campaign_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Campaign not found.")
    if doc["organizer_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="You can only submit your own campaigns.")
    if doc["status"] not in DRAFT_EDITABLE:
        raise HTTPException(status_code=400, detail="This campaign has already been submitted.")
    verification = doc.get("verification", {})
    verification["status"] = "IN_REVIEW"
    await db.campaigns.update_one({"id": campaign_id}, {"$set": {
        "status": "SUBMITTED", "verification": verification, "updated_at": now_iso(),
    }})
    await notify(user["id"], "campaign_created", "Campaign submitted",
                 f"“{doc['title']}” is now in review. We’ll let you know when it’s ready to go live.",
                 campaign_id)
    await track("campaign_submitted", user["id"], {"campaign_id": campaign_id})
    doc = await db.campaigns.find_one({"id": campaign_id}, {"_id": 0})
    return await serialize_campaign(doc, viewer=user, detail=True)


# ---------- updates ----------
@router.get("/campaigns/{campaign_id}/updates")
async def list_updates(campaign_id: str):
    ups = await db.campaign_updates.find({"campaign_id": campaign_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    out = []
    for u in ups:
        author = await db.users.find_one({"id": u.get("author_id")}, {"_id": 0})
        u["author_name"] = author["name"] if author else "Organizer"
        u["author_picture"] = author.get("picture") if author else None
        out.append(u)
    return out


@router.post("/campaigns/{campaign_id}/updates")
async def create_update(campaign_id: str, body: UpdateIn, user: dict = Depends(get_current_user)):
    doc = await db.campaigns.find_one({"id": campaign_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Campaign not found.")
    if doc["organizer_id"] != user["id"] and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only the organizer can post updates.")
    up = {
        "id": uid("upd_"), "campaign_id": campaign_id, "author_id": user["id"],
        "title": body.title, "body": body.body, "image": body.image,
        "milestone": body.milestone, "created_at": now_iso(),
    }
    await db.campaign_updates.insert_one(up)
    await db.campaigns.update_one({"id": campaign_id}, {
        "$inc": {"updates_count": 1}, "$set": {"last_update_at": now_iso()}})
    # notify followers
    followers = await db.campaign_followers.find({"campaign_id": campaign_id}, {"_id": 0}).to_list(1000)
    for f in followers:
        if f["user_id"] != user["id"]:
            await notify(f["user_id"], "campaign_update", "New campaign update",
                         f"“{doc['title']}” posted: {body.title}", campaign_id)
    await track("campaign_update_created", user["id"], {"campaign_id": campaign_id})
    return up


# ---------- follow / save ----------
@router.post("/campaigns/{campaign_id}/follow")
async def follow(campaign_id: str, user: dict = Depends(get_current_user)):
    if not await db.campaigns.find_one({"id": campaign_id}):
        raise HTTPException(status_code=404, detail="Campaign not found.")
    await db.campaign_followers.update_one(
        {"campaign_id": campaign_id, "user_id": user["id"]},
        {"$setOnInsert": {"id": uid("fol_"), "campaign_id": campaign_id,
                          "user_id": user["id"], "created_at": now_iso()}}, upsert=True)
    await track("campaign_followed", user["id"], {"campaign_id": campaign_id})
    return {"following": True}


@router.delete("/campaigns/{campaign_id}/follow")
async def unfollow(campaign_id: str, user: dict = Depends(get_current_user)):
    await db.campaign_followers.delete_one({"campaign_id": campaign_id, "user_id": user["id"]})
    return {"following": False}


@router.post("/campaigns/{campaign_id}/save")
async def save(campaign_id: str, user: dict = Depends(get_current_user)):
    if not await db.campaigns.find_one({"id": campaign_id}):
        raise HTTPException(status_code=404, detail="Campaign not found.")
    await db.saved_campaigns.update_one(
        {"campaign_id": campaign_id, "user_id": user["id"]},
        {"$setOnInsert": {"id": uid("sav_"), "campaign_id": campaign_id,
                          "user_id": user["id"], "created_at": now_iso()}}, upsert=True)
    await track("campaign_saved", user["id"], {"campaign_id": campaign_id})
    return {"saved": True}


@router.delete("/campaigns/{campaign_id}/save")
async def unsave(campaign_id: str, user: dict = Depends(get_current_user)):
    await db.saved_campaigns.delete_one({"campaign_id": campaign_id, "user_id": user["id"]})
    return {"saved": False}


@router.get("/saved")
async def saved_list(user: dict = Depends(get_current_user)):
    rows = await db.saved_campaigns.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    out = []
    for r in rows:
        d = await db.campaigns.find_one({"id": r["campaign_id"]}, {"_id": 0})
        if d:
            out.append(await serialize_campaign(d))
    return out


# ---------- report ----------
@router.post("/campaigns/{campaign_id}/report")
async def report(campaign_id: str, body: ReportIn, user: dict = Depends(get_current_user)):
    if not await db.campaigns.find_one({"id": campaign_id}):
        raise HTTPException(status_code=404, detail="Campaign not found.")
    rep = {
        "id": uid("rpt_"), "campaign_id": campaign_id, "reporter_id": user["id"],
        "reason": body.reason, "details": body.details or "", "status": "open",
        "created_at": now_iso(),
    }
    await db.reports.insert_one(rep)
    return {"ok": True, "message": "Thank you. Our team will review this campaign."}


# ---------- pause & resume ----------
@router.post("/campaigns/{campaign_id}/pause")
async def pause_campaign(campaign_id: str, user: dict = Depends(get_current_user)):
    doc = await db.campaigns.find_one({"id": campaign_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Campaign not found.")
    if doc["organizer_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Only the organizer can pause this campaign.")
    if doc.get("status") not in {"LIVE", "VERIFIED"}:
        raise HTTPException(status_code=400, detail="Only active live campaigns can be paused.")
    await db.campaigns.update_one({"id": campaign_id}, {"$set": {
        "status": "PAUSED", "updated_at": now_iso()}})
    await notify(user["id"], "campaign_paused", "Campaign paused",
                 f"“{doc['title']}” is now paused and hidden from active donation checkout.", campaign_id)
    doc = await db.campaigns.find_one({"id": campaign_id}, {"_id": 0})
    return await serialize_campaign(doc, viewer=user, detail=True)


@router.post("/campaigns/{campaign_id}/resume")
async def resume_campaign(campaign_id: str, user: dict = Depends(get_current_user)):
    doc = await db.campaigns.find_one({"id": campaign_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Campaign not found.")
    if doc["organizer_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Only the organizer can resume this campaign.")
    if doc.get("status") != "PAUSED":
        raise HTTPException(status_code=400, detail="Only paused campaigns can be resumed.")
    await db.campaigns.update_one({"id": campaign_id}, {"$set": {
        "status": "LIVE", "updated_at": now_iso()}})
    await notify(user["id"], "campaign_live", "Campaign resumed! 🎉",
                 f"“{doc['title']}” is back live and accepting donations.", campaign_id)
    doc = await db.campaigns.find_one({"id": campaign_id}, {"_id": 0})
    return await serialize_campaign(doc, viewer=user, detail=True)

