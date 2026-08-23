"""Admin moderation: campaigns, verification, reports, users, transactions, stats."""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional

from core import db, now_iso, require_admin, serialize_campaign, notify, uid

router = APIRouter(prefix="/api/admin", tags=["admin"])


class VerifyChecks(BaseModel):
    identity: bool = False
    beneficiary: bool = False
    documents: bool = False
    relationship: bool = False
    updates_enabled: bool = True


class RejectIn(BaseModel):
    reason: str


@router.get("/stats")
async def stats(admin: dict = Depends(require_admin)):
    total_campaigns = await db.campaigns.count_documents({})
    live = await db.campaigns.count_documents({"status": "LIVE"})
    pending_review = await db.campaigns.count_documents({"status": {"$in": ["SUBMITTED", "UNDER_REVIEW"]}})
    open_reports = await db.reports.count_documents({"status": "open"})
    users = await db.users.count_documents({})
    paid = await db.donations.find({"status": "paid"}, {"_id": 0}).to_list(5000)
    raised = sum(d["amount_kobo"] for d in paid)
    return {
        "total_campaigns": total_campaigns, "live_campaigns": live,
        "pending_review": pending_review, "open_reports": open_reports,
        "total_users": users, "total_raised_kobo": raised,
        "total_donations": len(paid),
    }


@router.get("/campaigns")
async def admin_campaigns(status: Optional[str] = None, admin: dict = Depends(require_admin)):
    query = {"status": status} if status else {}
    docs = await db.campaigns.find(query, {"_id": 0}).sort("created_at", -1).limit(100).to_list(100)
    return [await serialize_campaign(d, detail=True) for d in docs]


@router.post("/campaigns/{campaign_id}/verify")
async def verify_campaign(campaign_id: str, checks: VerifyChecks, admin: dict = Depends(require_admin)):
    doc = await db.campaigns.find_one({"id": campaign_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Campaign not found.")
    verification = {"status": "VERIFIED", "checks": checks.dict(),
                    "verified_at": now_iso(), "verified_by": admin["id"]}
    await db.campaigns.update_one({"id": campaign_id}, {"$set": {
        "status": "VERIFIED", "verification": verification, "updated_at": now_iso()}})
    await db.verification_checks.insert_one({
        "id": uid("vch_"), "campaign_id": campaign_id, "checks": checks.dict(),
        "reviewer_id": admin["id"], "created_at": now_iso()})
    await notify(doc["organizer_id"], "campaign_verified", "Verification complete",
                 f"“{doc['title']}” passed GoodCause verification checks. You can publish it now.",
                 campaign_id)
    doc = await db.campaigns.find_one({"id": campaign_id}, {"_id": 0})
    return await serialize_campaign(doc, detail=True)


@router.post("/campaigns/{campaign_id}/publish")
async def publish_campaign(campaign_id: str, admin: dict = Depends(require_admin)):
    doc = await db.campaigns.find_one({"id": campaign_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Campaign not found.")
    if doc["status"] not in {"VERIFIED", "PAUSED"}:
        raise HTTPException(status_code=400, detail="Campaign must be verified before going live.")
    await db.campaigns.update_one({"id": campaign_id}, {"$set": {
        "status": "LIVE", "published_at": doc.get("published_at") or now_iso(),
        "updated_at": now_iso()}})
    await notify(doc["organizer_id"], "campaign_live", "Your campaign is live! 🎉",
                 f"“{doc['title']}” is now live and accepting donations.", campaign_id)
    doc = await db.campaigns.find_one({"id": campaign_id}, {"_id": 0})
    return await serialize_campaign(doc, detail=True)


@router.post("/campaigns/{campaign_id}/reject")
async def reject_campaign(campaign_id: str, body: RejectIn, admin: dict = Depends(require_admin)):
    doc = await db.campaigns.find_one({"id": campaign_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Campaign not found.")
    verification = doc.get("verification", {})
    verification["status"] = "REJECTED"
    verification["reason"] = body.reason
    await db.campaigns.update_one({"id": campaign_id}, {"$set": {
        "status": "REJECTED", "verification": verification, "updated_at": now_iso()}})
    await notify(doc["organizer_id"], "campaign_rejected", "Campaign needs changes",
                 body.reason, campaign_id)
    doc = await db.campaigns.find_one({"id": campaign_id}, {"_id": 0})
    return await serialize_campaign(doc, detail=True)


@router.post("/campaigns/{campaign_id}/suspend")
async def suspend_campaign(campaign_id: str, admin: dict = Depends(require_admin)):
    doc = await db.campaigns.find_one({"id": campaign_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Campaign not found.")
    await db.campaigns.update_one({"id": campaign_id}, {"$set": {
        "status": "SUSPENDED", "updated_at": now_iso()}})
    await notify(doc["organizer_id"], "campaign_suspended", "Campaign suspended",
                 f"“{doc['title']}” has been suspended pending review.", campaign_id)
    doc = await db.campaigns.find_one({"id": campaign_id}, {"_id": 0})
    return await serialize_campaign(doc, detail=True)


@router.get("/reports")
async def admin_reports(admin: dict = Depends(require_admin)):
    rows = await db.reports.find({}, {"_id": 0}).sort("created_at", -1).limit(100).to_list(100)
    out = []
    for r in rows:
        c = await db.campaigns.find_one({"id": r["campaign_id"]}, {"_id": 0})
        r["campaign_title"] = c["title"] if c else "Unknown"
        out.append(r)
    return out


class ReportAction(BaseModel):
    action: str  # resolve / dismiss


@router.post("/reports/{report_id}/action")
async def report_action(report_id: str, body: ReportAction, admin: dict = Depends(require_admin)):
    status = "resolved" if body.action == "resolve" else "dismissed"
    await db.reports.update_one({"id": report_id}, {"$set": {
        "status": status, "resolved_at": now_iso(), "resolved_by": admin["id"]}})
    return {"ok": True, "status": status}


@router.get("/users")
async def admin_users(admin: dict = Depends(require_admin)):
    rows = await db.users.find({}, {"_id": 0, "password_hash": 0}).sort("created_at", -1).limit(200).to_list(200)
    return rows


@router.get("/transactions")
async def admin_transactions(admin: dict = Depends(require_admin)):
    rows = await db.donations.find({}, {"_id": 0}).sort("created_at", -1).limit(200).to_list(200)
    return rows
