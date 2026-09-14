"""Donation identity, privacy, and Paystack reconciliation policy."""

from typing import Optional


def donation_identity(user: Optional[dict], anonymous: bool) -> dict:
    """Preserve private ownership while controlling only the public display."""
    return {
        "donor_id": user.get("id") if user else None,
        "donor_name": user.get("name") if user else None,
        "donor_email": user.get("email") if user else None,
        "anonymous": bool(anonymous),
    }


def public_donation(row: dict) -> dict:
    anonymous = bool(row.get("anonymous"))
    return {
        "id": row["id"],
        "name": "Anonymous" if anonymous else (row.get("donor_name") or "Supporter"),
        "amount_kobo": row["amount_kobo"],
        "message": "" if anonymous else (row.get("message") or ""),
        "anonymous": anonymous,
        "created_at": row.get("paid_at"),
        "can_thank": bool(row.get("donor_id") and not anonymous),
        "thanked": bool(row.get("thanked")),
    }


def normalize_paystack_transaction(data: dict) -> dict:
    transaction_id = data.get("id")
    return {
        "status": data.get("status"),
        "reference": data.get("reference"),
        "verified_amount_kobo": data.get("amount"),
        "currency": data.get("currency"),
        "provider_transaction_id": str(transaction_id) if transaction_id is not None else None,
        "payment_channel": data.get("channel"),
        "provider_fee_kobo": data.get("fees"),
        "provider_paid_at": data.get("paid_at"),
    }


def payment_matches_donation(payment: dict, donation: dict) -> bool:
    return (
        payment.get("status") == "success"
        and payment.get("currency") == "NGN"
        and payment.get("reference") == donation.get("reference")
        and payment.get("verified_amount_kobo") == donation.get("amount_kobo")
    )
