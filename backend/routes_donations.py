"""Donations, payments (Paystack + sandbox), impact dashboard."""
import os
from fastapi import APIRouter, HTTPException, Depends, Request, Header
from pydantic import BaseModel, Field, EmailStr
from typing import Optional

from core import (db, uid, now_iso, get_current_user, get_current_user_optional,
                  notify, track, campaign_percent, serialize_campaign)
from payments import get_provider, provider_mode, PaystackProvider, paystack_configured
from donation_policy import (donation_identity, normalize_paystack_transaction,
                             payment_matches_donation, public_donation)
from donation_ledger import apply_verified_donation

router = APIRouter(prefix="/api", tags=["donations"])

MILESTONES = [25, 50, 75, 90, 100]
FRONTEND_RETURN_URL = os.environ.get("FRONTEND_RETURN_URL", "goodcause://payment-result")


class DonateIn(BaseModel):
    amount_kobo: int = Field(gt=0)
    anonymous: bool = False
    message: Optional[str] = Field(default="", max_length=280)
    email: Optional[EmailStr] = None
    return_url: Optional[str] = None


async def _apply_paid(reference: str, payment: Optional[dict] = None) -> Optional[dict]:
    """Atomically credit a verified donation and send post-commit notifications once."""
    donation = await db.donations.find_one({"reference": reference}, {"_id": 0})
    if not donation:
        return None
    ledger = await apply_verified_donation(reference, payment)
    if not ledger:
        return None

    new_pct = campaign_percent(ledger["raised_kobo"], ledger["goal_kobo"])
    if ledger.get("already"):
        return {
            "already": True, "campaign_id": ledger["id"],
            "raised_kobo": ledger["raised_kobo"], "new_percent": new_pct,
        }

    previous_raised = ledger["raised_kobo"] - ledger["amount_kobo"]
    prev_pct = campaign_percent(previous_raised, ledger["goal_kobo"])
    campaign = await db.campaigns.find_one({"id": ledger["id"]}, {"_id": 0}) or {}
    reached = list(campaign.get("milestones_reached", []))
    newly = [m for m in MILESTONES if prev_pct < m <= new_pct and m not in reached]
    set_fields = {"milestones_reached": sorted(set(reached + newly))}
    if new_pct >= 100 and ledger.get("status") == "LIVE":
        set_fields["status"] = "COMPLETED"
    await db.campaigns.update_one({"id": ledger["id"]}, {"$set": set_fields})

    amt = ledger["amount_kobo"] // 100
    await notify(ledger["organizer_id"], "donation_received", "New donation received",
                 f"You received ₦{amt:,} for “{ledger['title']}”.", ledger["id"])
    if ledger.get("donor_id"):
        await notify(ledger["donor_id"], "donation_thankyou",
                     "Thank you for your generosity 💛",
                     f"Your ₦{amt:,} gift is helping move “{ledger['title']}” forward. "
                     f"It's now at {new_pct}% of its goal.", ledger["id"])
    for milestone in newly:
        title = "Campaign complete! 🎉" if milestone == 100 else f"{milestone}% milestone reached"
        await notify(ledger["organizer_id"], f"campaign_{milestone}_percent", title,
                     f"“{ledger['title']}” has reached {milestone}% of its goal.", ledger["id"])
        followers = await db.campaign_followers.find(
            {"campaign_id": ledger["id"]}, {"_id": 0}
        ).to_list(1000)
        for follower in followers:
            await notify(follower["user_id"], f"campaign_{milestone}_percent", title,
                         f"A cause you follow reached {milestone}%.", ledger["id"])

    await track("donation_completed", ledger.get("donor_id"), {
        "campaign_id": ledger["id"], "amount_kobo": ledger["amount_kobo"],
        "provider": ledger.get("provider"),
    })
    return {
        "prev_percent": prev_pct, "new_percent": new_pct,
        "campaign_id": ledger["id"], "raised_kobo": ledger["raised_kobo"],
        "milestones": newly,
    }


@router.post("/campaigns/{campaign_id}/donate")
async def initialize_donation(campaign_id: str, body: DonateIn,
                              user: Optional[dict] = Depends(get_current_user_optional)):
    campaign = await db.campaigns.find_one({"id": campaign_id}, {"_id": 0})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found.")
    if campaign["status"] not in {"LIVE", "COMPLETED"}:
        raise HTTPException(status_code=400, detail="This campaign is not accepting donations right now.")

    email = body.email or (user or {}).get("email") or "donor@goodcause.app"
    reference = uid("don_")
    provider = get_provider()
    donation = {
        "id": uid("dnt_"), "reference": reference, "campaign_id": campaign_id,
        **donation_identity(user, body.anonymous),
        "message": body.message or "",
        "amount_kobo": body.amount_kobo, 
        "status": "pending", "provider": provider.name,
        "is_test": provider.name == "sandbox", 
        "created_at": now_iso(), "paid_at": None,
    }
    await db.donations.insert_one(donation)
    await track("donation_started", donation["donor_id"],
                {"campaign_id": campaign_id, "amount_kobo": body.amount_kobo})

    try:
        init = await provider.initialize(
            reference=reference, amount_kobo=body.amount_kobo, email=email,
            callback_url=body.return_url or FRONTEND_RETURN_URL,
            metadata={"campaign_id": campaign_id, "reference": reference})
    except Exception:
        await db.donations.update_one({"reference": reference}, {"$set": {"status": "failed"}})
        await track("donation_failed", donation["donor_id"], {"campaign_id": campaign_id})
        raise HTTPException(status_code=502, detail="We couldn’t start that payment. Please try again.")

    return {
        "reference": reference, "mode": provider_mode(), "provider": provider.name,
        "sandbox": provider.name == "sandbox",
        "authorization_url": init.get("authorization_url"),
        "access_code": init.get("access_code"),
    }


@router.post("/donations/sandbox-complete")
async def sandbox_complete(reference: str = Header(None, alias="X-Reference"),
                           body: dict = None):
    ref = reference or (body or {}).get("reference")
    if not ref:
        raise HTTPException(status_code=400, detail="Missing reference.")
    if paystack_configured():
        raise HTTPException(status_code=400, detail="Live payments are enabled; use the checkout link.")
    donation = await db.donations.find_one({"reference": ref}, {"_id": 0})
    if not donation:
        raise HTTPException(status_code=404, detail="Donation not found.")
    if donation.get("provider") != "sandbox":
        raise HTTPException(status_code=400, detail="Not a sandbox donation.")
    result = await _apply_paid(ref)
    if not result:
        raise HTTPException(status_code=400, detail="Could not complete donation.")
    campaign = await db.campaigns.find_one({"id": donation["campaign_id"]}, {"_id": 0})
    return {"status": "paid", "test": True,
            "prev_percent": result.get("prev_percent"),
            "new_percent": result.get("new_percent"),
            "milestones": result.get("milestones", []),
            "campaign": await serialize_campaign(campaign)}


class VerifyIn(BaseModel):
    reference: str


@router.post("/payments/verify")
async def verify_payment(body: VerifyIn):
    if not paystack_configured():
        raise HTTPException(status_code=503, detail="Live payments are not configured yet.")
    donation = await db.donations.find_one({"reference": body.reference}, {"_id": 0})
    if not donation:
        raise HTTPException(status_code=404, detail="Donation not found.")
    provider = get_provider()
    v = await provider.verify(body.reference)
    result = None
    if payment_matches_donation(v, donation):
        result = await _apply_paid(body.reference, v)
    d = await db.donations.find_one({"reference": body.reference}, {"_id": 0})
    response = {"reference": body.reference, "status": d["status"]}
    if d["status"] == "paid" and result:
        response.update({
            "campaign_id": result.get("campaign_id"),
            "raised_kobo": result.get("raised_kobo"),
            "prev_percent": result.get("prev_percent"),
            "new_percent": result.get("new_percent"),
        })
    return response


@router.post("/payments/paystack/webhook")
async def paystack_webhook(request: Request):
    raw = await request.body()
    sig = request.headers.get("x-paystack-signature", "")
    if not paystack_configured() or not PaystackProvider.verify_signature(raw, sig):
        raise HTTPException(status_code=401, detail="Invalid signature.")
    event = await request.json()
    if event.get("event") == "charge.success":
        data = event.get("data", {})
        ref = data.get("reference")
        donation = await db.donations.find_one({"reference": ref}, {"_id": 0})
        payment = normalize_paystack_transaction(data)
        if donation and payment_matches_donation(payment, donation):
            await _apply_paid(ref, payment)
    return {"received": True}


@router.get("/campaigns/{campaign_id}/donations")
async def campaign_donations(campaign_id: str):
    rows = await db.donations.find(
        {"campaign_id": campaign_id, "status": "paid"}, {"_id": 0}
    ).sort("paid_at", -1).limit(30).to_list(30)
    return [public_donation(row) for row in rows]


class ThankIn(BaseModel):
    donation_id: str
    message: str = Field(min_length=1, max_length=500)
    image: Optional[str] = None


@router.post("/campaigns/{campaign_id}/thank")
async def thank_supporter(campaign_id: str, body: ThankIn, user: dict = Depends(get_current_user)):
    campaign = await db.campaigns.find_one({"id": campaign_id}, {"_id": 0})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found.")
    if campaign["organizer_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Only the organizer can thank supporters.")
    donation = await db.donations.find_one({"id": body.donation_id, "campaign_id": campaign_id}, {"_id": 0})
    if not donation:
        raise HTTPException(status_code=404, detail="Donation not found.")
    if not donation.get("donor_id") or donation.get("anonymous"):
        raise HTTPException(status_code=400, detail="This supporter can't be messaged.")
    note = {
        "id": uid("thx_"), "campaign_id": campaign_id, "donation_id": body.donation_id,
        "from_id": user["id"], "to_id": donation["donor_id"],
        "message": body.message.strip(), "image": body.image, "created_at": now_iso(),
    }
    await db.thank_you_notes.insert_one(note)
    await db.donations.update_one({"id": body.donation_id}, {"$set": {"thanked": True}})
    body_text = body.message.strip()
    if body.image:
        body_text += "  📷"
    await notify(donation["donor_id"], "organizer_thankyou",
                 f"A thank-you from {campaign['title']}", body_text, campaign_id)
    return {"ok": True, "message": "Your thank-you has been sent."}


@router.get("/donations/mine")
async def my_donations(user: dict = Depends(get_current_user)):
    rows = await db.donations.find(
        {"donor_id": user["id"], "status": "paid"}, {"_id": 0}
    ).sort("paid_at", -1).to_list(200)
    out = []
    for r in rows:
        c = await db.campaigns.find_one({"id": r["campaign_id"]}, {"_id": 0})
        out.append({
            "id": r["id"], "amount_kobo": r["amount_kobo"], "message": r.get("message", ""),
            "anonymous": r.get("anonymous", False), "created_at": r.get("paid_at"),
            "campaign": {"id": c["id"], "title": c["title"], "cover_image": c.get("cover_image"),
                         "status": c.get("status")} if c else None,
        })
    return out


@router.get("/impact")
async def impact(user: dict = Depends(get_current_user)):
    rows = await db.donations.find(
        {"donor_id": user["id"], "status": "paid"}, {"_id": 0}).to_list(500)
    total = sum(r["amount_kobo"] for r in rows)
    campaign_ids = list({r["campaign_id"] for r in rows})
    completed = 0
    for cid in campaign_ids:
        c = await db.campaigns.find_one({"id": cid}, {"_id": 0})
        if c and c.get("status") == "COMPLETED":
            completed += 1
    following = await db.campaign_followers.count_documents({"user_id": user["id"]})
    return {
        "total_contributed_kobo": total,
        "causes_supported": len(campaign_ids),
        "donations_count": len(rows),
        "campaigns_completed": completed,
        "following_count": following,
    }
