"""Fan Zone — personal gifting pages (Buy-Me-a-Coffee-style)."""
import os
import uuid
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field, EmailStr
from typing import Optional

from core import (db, uid, now_iso, get_current_user, get_current_user_optional,
                  notify, track, public_user)
from payments import get_provider, provider_mode, PaystackProvider, paystack_configured
from donation_policy import donation_identity
import supabase_db

router = APIRouter(prefix="/api", tags=["fan-zone"])

FRONTEND_RETURN_URL = os.environ.get("FRONTEND_RETURN_URL", "goodcause://payment-result")

FAN_GIFT_PRESETS = [50000, 100000, 250000, 500000, 1000000]  # ₦500 / 1k / 2.5k / 5k / 10k


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _public_gift(gift: dict) -> dict:
    return {
        "id": gift["id"],
        "amount_kobo": gift["amount_kobo"],
        "name": "Anonymous" if gift.get("anonymous") else (gift.get("donor_name") or "Someone"),
        "message": gift.get("message") or "",
        "paid_at": gift.get("paid_at"),
        "anonymous": gift.get("anonymous", False),
    }


async def _get_fan_zone(user_id: str) -> Optional[dict]:
    return await db.fan_zones.find_one({"user_id": user_id}, {"_id": 0})


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class FanZoneSetupIn(BaseModel):
    enabled: bool = True
    headline: Optional[str] = Field(default=None, max_length=160)
    thank_you_message: Optional[str] = Field(default=None, max_length=500)
    cover_image: Optional[str] = None       # hero banner URL
    profile_picture: Optional[str] = None  # fan-zone-specific avatar override


class GiftIn(BaseModel):
    amount_kobo: int = Field(gt=0)
    anonymous: bool = False
    message: Optional[str] = Field(default="", max_length=280)
    email: Optional[EmailStr] = None
    return_url: Optional[str] = None


# ---------------------------------------------------------------------------
# Authenticated: setup / update my fan zone
# NOTE: these /me routes MUST be declared before /users/{user_id}/... so that
# FastAPI matches the literal "me" before the dynamic {user_id} wildcard.
# ---------------------------------------------------------------------------

@router.get("/users/me/fan-zone")
async def my_fan_zone(user: dict = Depends(get_current_user)):
    zone = await _get_fan_zone(user["id"])
    gifts = await db.fan_gifts.find(
        {"recipient_id": user["id"], "status": "paid"}, {"_id": 0}
    ).sort("paid_at", -1).limit(50).to_list(50)

    _total_row = await supabase_db.query_one(
        "SELECT COALESCE(SUM(amount_kobo), 0) AS total FROM fan_gifts WHERE recipient_id = $1 AND status = 'paid'",
        user["id"]
    )
    total = int(_total_row["total"]) if _total_row else 0

    return {
        "enabled": zone.get("enabled", False) if zone else False,
        "headline": zone.get("headline") if zone else None,
        "thank_you_message": zone.get("thank_you_message") if zone else None,
        "cover_image": zone.get("cover_image") if zone else None,
        "profile_picture": zone.get("profile_picture") if zone else None,
        "total_received_kobo": total,
        "supporters_count": len(gifts),
        "recent_gifts": [
            {
                **_public_gift(g),
                "donor_id": g.get("donor_id"),
                "is_test": g.get("is_test", False),
            }
            for g in gifts
        ],
    }


@router.post("/users/me/fan-zone")
async def setup_fan_zone(body: FanZoneSetupIn, user: dict = Depends(get_current_user)):
    existing = await _get_fan_zone(user["id"])
    doc = {
        "enabled": body.enabled,
        "headline": body.headline,
        "thank_you_message": body.thank_you_message,
        "cover_image": body.cover_image,
        "profile_picture": body.profile_picture,
        "updated_at": now_iso(),
    }
    if existing:
        await db.fan_zones.update_one({"user_id": user["id"]}, {"$set": doc})
    else:
        await db.fan_zones.insert_one({"user_id": user["id"], "created_at": now_iso(), **doc})
    return {"ok": True}


# ---------------------------------------------------------------------------
# Public: view a user's fan zone page
# ---------------------------------------------------------------------------

@router.get("/users/{user_id}/fan-zone")
async def get_fan_zone(user_id: str):
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    zone = await _get_fan_zone(user_id)
    if not zone or not zone.get("enabled", True):
        raise HTTPException(status_code=404, detail="This user hasn't set up a Fan Zone yet.")

    # Recent paid gifts (public wall)
    gifts = await db.fan_gifts.find(
        {"recipient_id": user_id, "status": "paid"}, {"_id": 0}
    ).sort("paid_at", -1).limit(20).to_list(20)

    _total_row = await supabase_db.query_one(
        "SELECT COALESCE(SUM(amount_kobo), 0) AS total FROM fan_gifts WHERE recipient_id = $1 AND status = 'paid'",
        user_id
    )
    total = int(_total_row["total"]) if _total_row else 0
    supporters_count = await db.fan_gifts.count_documents({"recipient_id": user_id, "status": "paid"})

    # Profile picture: fan-zone override takes priority, then user's account picture
    profile_pic = zone.get("profile_picture") or user.get("picture")

    return {
        "user": {**public_user(user), "picture": profile_pic},
        "headline": zone.get("headline") or f"Support {user['name']}",
        "thank_you_message": zone.get("thank_you_message") or "Your support means the world — thank you! 💛",
        "cover_image": zone.get("cover_image"),
        "presets": FAN_GIFT_PRESETS,
        "total_received_kobo": total,
        "supporters_count": supporters_count,
        "recent_gifts": [_public_gift(g) for g in gifts],
    }


# ---------------------------------------------------------------------------
# Send a gift (payment init)
# ---------------------------------------------------------------------------

@router.post("/users/{user_id}/gift")
async def initialize_gift(
    user_id: str,
    body: GiftIn,
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    recipient = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not recipient:
        raise HTTPException(status_code=404, detail="User not found.")

    zone = await _get_fan_zone(user_id)
    if not zone or not zone.get("enabled", True):
        raise HTTPException(status_code=400, detail="This user's Fan Zone is not active.")

    if current_user and current_user["id"] == user_id:
        raise HTTPException(status_code=400, detail="You can't send a gift to yourself.")

    if body.amount_kobo < 10000:
        raise HTTPException(status_code=400, detail="Minimum gift is ₦100.")

    email = body.email or (current_user or {}).get("email") or "donor@goodcause.app"
    reference = uid("fgft_")
    provider = get_provider()

    # Build donor identity (reuse donation_policy helper with a stub body)
    identity = donation_identity(current_user, body.anonymous)

    gift = {
        "id": uid("fg_"),
        "reference": reference,
        "recipient_id": user_id,
        **identity,
        "message": body.message or "",
        "amount_kobo": body.amount_kobo,
        "status": "pending",
        "provider": provider.name,
        "is_test": provider.name == "sandbox",
        "created_at": now_iso(),
        "paid_at": None,
    }
    await db.fan_gifts.insert_one(gift)
    await track("fan_gift_started", gift.get("donor_id"), {"recipient_id": user_id, "amount_kobo": body.amount_kobo})

    try:
        init = await provider.initialize(
            reference=reference,
            amount_kobo=body.amount_kobo,
            email=email,
            callback_url=body.return_url or FRONTEND_RETURN_URL,
            metadata={"recipient_id": user_id, "reference": reference},
        )
    except Exception:
        await db.fan_gifts.update_one({"reference": reference}, {"$set": {"status": "failed"}})
        raise HTTPException(status_code=502, detail="We couldn't start that payment. Please try again.")

    return {
        "reference": reference,
        "mode": provider_mode(),
        "provider": provider.name,
        "sandbox": provider.name == "sandbox",
        "authorization_url": init.get("authorization_url"),
        "access_code": init.get("access_code"),
    }


# ---------------------------------------------------------------------------
# Verify / complete a gift payment
# ---------------------------------------------------------------------------

async def _apply_paid_gift(reference: str) -> Optional[dict]:
    gift = await db.fan_gifts.find_one({"reference": reference}, {"_id": 0})
    if not gift or gift.get("status") == "paid":
        return gift  # idempotent
    await db.fan_gifts.update_one(
        {"reference": reference},
        {"$set": {"status": "paid", "paid_at": now_iso()}},
    )
    await notify(
        gift["recipient_id"], "fan_gift_received",
        "Someone sent you a gift! 💛",
        f"You received ₦{gift['amount_kobo'] // 100:,} via your Fan Zone.",
    )
    await track("fan_gift_completed", gift.get("donor_id"), {
        "recipient_id": gift["recipient_id"], "amount_kobo": gift["amount_kobo"],
    })
    return {**gift, "status": "paid"}


class GiftVerifyIn(BaseModel):
    reference: str


@router.post("/fan-gifts/sandbox-complete")
async def sandbox_complete_gift(body: GiftVerifyIn):
    if paystack_configured():
        raise HTTPException(status_code=400, detail="Live payments are enabled; use the checkout link.")
    gift = await db.fan_gifts.find_one({"reference": body.reference}, {"_id": 0})
    if not gift:
        raise HTTPException(status_code=404, detail="Gift not found.")
    if gift.get("provider") != "sandbox":
        raise HTTPException(status_code=400, detail="Not a sandbox gift.")
    result = await _apply_paid_gift(body.reference)
    if not result:
        raise HTTPException(status_code=400, detail="Could not complete gift.")
    recipient = await db.users.find_one({"id": gift["recipient_id"]}, {"_id": 0})
    zone = await _get_fan_zone(gift["recipient_id"])
    return {
        "status": "paid",
        "test": True,
        "thank_you_message": (zone or {}).get("thank_you_message") or "Your support means the world — thank you! 💛",
        "recipient_name": (recipient or {}).get("name", ""),
    }


@router.post("/fan-gifts/verify")
async def verify_gift(body: GiftVerifyIn):
    if not paystack_configured():
        raise HTTPException(status_code=503, detail="Live payments are not configured yet.")
    gift = await db.fan_gifts.find_one({"reference": body.reference}, {"_id": 0})
    if not gift:
        raise HTTPException(status_code=404, detail="Gift not found.")
    provider = get_provider()
    v = await provider.verify(body.reference)
    result = None
    if v and v.get("status") == "success" and v.get("amount") == gift["amount_kobo"]:
        result = await _apply_paid_gift(body.reference)
    g = await db.fan_gifts.find_one({"reference": body.reference}, {"_id": 0})
    response = {"reference": body.reference, "status": g["status"]}
    if g["status"] == "paid":
        recipient = await db.users.find_one({"id": gift["recipient_id"]}, {"_id": 0})
        zone = await _get_fan_zone(gift["recipient_id"])
        response["thank_you_message"] = (zone or {}).get("thank_you_message") or "Your support means the world — thank you! 💛"
        response["recipient_name"] = (recipient or {}).get("name", "")
    return response


# ---------------------------------------------------------------------------
# Dashboard — owner earnings overview + full gift history
# ---------------------------------------------------------------------------

@router.get("/users/me/fan-zone/dashboard")
async def fan_zone_dashboard(
    page: int = Query(default=1, ge=1),
    user: dict = Depends(get_current_user),
):
    """
    Returns balance summary (total received, withdrawn, available) plus
    a paginated, full gift history (all statuses) for the owner's dashboard.
    """
    PAGE_SIZE = 30
    offset = (page - 1) * PAGE_SIZE

    zone = await _get_fan_zone(user["id"])

    # Aggregate totals from paid gifts
    total_row = await supabase_db.query_one(
        "SELECT COALESCE(SUM(amount_kobo), 0) AS total, COUNT(*) AS cnt "
        "FROM fan_gifts WHERE recipient_id = $1 AND status = 'paid'",
        user["id"],
    )
    total_received_kobo = int(total_row["total"]) if total_row else 0
    supporters_count = int(total_row["cnt"]) if total_row else 0

    # How much has already been withdrawn
    withdrawn_kobo = int((zone or {}).get("withdrawn_kobo", 0))
    available_kobo = max(0, total_received_kobo - withdrawn_kobo)

    # Paginated gift history (all paid gifts, newest first)
    gifts_page = await db.fan_gifts.find(
        {"recipient_id": user["id"], "status": "paid"}, {"_id": 0}
    ).sort("paid_at", -1).skip(offset).limit(PAGE_SIZE).to_list(PAGE_SIZE)

    # Total count for pagination
    total_gifts_row = await supabase_db.query_one(
        "SELECT COUNT(*) AS cnt FROM fan_gifts WHERE recipient_id = $1 AND status = 'paid'",
        user["id"],
    )
    total_gifts = int(total_gifts_row["cnt"]) if total_gifts_row else 0

    # Payout history
    payout_docs = await db.fan_zone_payouts.find(
        {"user_id": user["id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)

    # Linked bank account (reuse the user's saved bank account)
    bank_account = None
    acc = await db.bank_accounts.find_one({"user_id": user["id"]}, {"_id": 0})
    if acc:
        bank_account = {
            "bank_name": acc["bank_name"],
            "account_number": acc["account_number"],
            "account_name": acc["account_name"],
        }

    return {
        "total_received_kobo": total_received_kobo,
        "withdrawn_kobo": withdrawn_kobo,
        "available_kobo": available_kobo,
        "supporters_count": supporters_count,
        "bank_account": bank_account,
        "gifts": [
            {
                **_public_gift(g),
                "donor_id": g.get("donor_id"),
                "is_test": g.get("is_test", False),
            }
            for g in gifts_page
        ],
        "gifts_total": total_gifts,
        "gifts_page": page,
        "gifts_page_size": PAGE_SIZE,
        "payouts": payout_docs,
    }


# ---------------------------------------------------------------------------
# Withdraw fan zone earnings
# ---------------------------------------------------------------------------

class FanZoneWithdrawIn(BaseModel):
    amount_kobo: int = Field(gt=0)


@router.post("/users/me/fan-zone/withdraw")
async def withdraw_fan_zone_funds(
    body: FanZoneWithdrawIn,
    user: dict = Depends(get_current_user),
):
    zone = await _get_fan_zone(user["id"])
    if not zone:
        raise HTTPException(status_code=404, detail="Fan Zone not set up yet.")

    total_row = await supabase_db.query_one(
        "SELECT COALESCE(SUM(amount_kobo), 0) AS total FROM fan_gifts "
        "WHERE recipient_id = $1 AND status = 'paid'",
        user["id"],
    )
    total_received = int(total_row["total"]) if total_row else 0
    withdrawn = int(zone.get("withdrawn_kobo", 0))
    available = max(0, total_received - withdrawn)

    if body.amount_kobo > available:
        raise HTTPException(
            status_code=400,
            detail=f"Amount exceeds available balance. Available: ₦{available // 100:,}",
        )

    # Must have a linked bank account
    acc = await db.bank_accounts.find_one({"user_id": user["id"]}, {"_id": 0})
    if not acc:
        raise HTTPException(
            status_code=400,
            detail="Please link a verified bank account before withdrawing.",
        )

    payout_id = uid("fzpout_")
    ref = f"FZWD-{uuid.uuid4().hex[:10].upper()}"
    created = now_iso()

    await db.fan_zone_payouts.insert_one({
        "id": payout_id,
        "user_id": user["id"],
        "amount_kobo": body.amount_kobo,
        "currency": "NGN",
        "bank_name": acc["bank_name"],
        "account_number": acc["account_number"],
        "account_name": acc["account_name"],
        "status": "SUCCESS",
        "reference": ref,
        "created_at": created,
    })

    new_withdrawn = withdrawn + body.amount_kobo
    await db.fan_zones.update_one(
        {"user_id": user["id"]},
        {"$set": {"withdrawn_kobo": new_withdrawn, "updated_at": created}},
    )

    await notify(
        user["id"], "fan_zone_payout",
        "Withdrawal Successful 💸",
        f"₦{body.amount_kobo // 100:,} is on its way to {acc['bank_name']} "
        f"({acc['account_number'][-4:]}). Ref: {ref}",
    )

    return {
        "ok": True,
        "payout_id": payout_id,
        "reference": ref,
        "amount_kobo": body.amount_kobo,
        "new_withdrawn_kobo": new_withdrawn,
        "new_available_kobo": max(0, total_received - new_withdrawn),
        "bank_name": acc["bank_name"],
        "account_number": acc["account_number"],
    }
