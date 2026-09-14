"""Atomic PostgreSQL operations for applying verified donations."""

from datetime import datetime, timezone
from typing import Optional

import supabase_db


APPLY_PAID_SQL = """
WITH claimed AS (
    UPDATE donations
       SET status = 'paid',
           paid_at = COALESCE($6::timestamptz, $7::timestamptz),
           verified_amount_kobo = COALESCE($2, amount_kobo),
           provider_transaction_id = $3,
           payment_channel = $4,
           provider_fee_kobo = $5,
           provider_paid_at = $6::timestamptz,
           accounted_at = $7::timestamptz
     WHERE reference = $1 AND status = 'pending'
 RETURNING *
), credited AS (
    UPDATE campaigns AS campaign
       SET raised_kobo = COALESCE(campaign.raised_kobo, 0) + claimed.amount_kobo,
           supporters_count = COALESCE(campaign.supporters_count, 0) +
             CASE
               WHEN claimed.donor_id IS NULL THEN 1
               WHEN EXISTS (
                 SELECT 1 FROM donations previous
                  WHERE previous.campaign_id = claimed.campaign_id
                    AND previous.donor_id = claimed.donor_id
                    AND previous.status = 'paid'
                    AND previous.reference <> claimed.reference
               ) THEN 0
               ELSE 1
             END
      FROM claimed
     WHERE campaign.id = claimed.campaign_id
 RETURNING campaign.id, campaign.title, campaign.organizer_id,
           campaign.goal_kobo, campaign.raised_kobo, campaign.status,
           claimed.reference, claimed.amount_kobo, claimed.donor_id,
           claimed.anonymous, claimed.provider
)
SELECT * FROM credited
"""


ALREADY_PAID_SQL = """
SELECT campaign.id, campaign.title, campaign.organizer_id,
       campaign.goal_kobo, campaign.raised_kobo, campaign.status,
       donation.reference, donation.amount_kobo, donation.donor_id,
       donation.anonymous, donation.provider
  FROM donations donation
  JOIN campaigns campaign ON campaign.id = donation.campaign_id
 WHERE donation.reference = $1 AND donation.status = 'paid'
"""


def _timestamp(value: object) -> Optional[datetime]:
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


async def apply_verified_donation(reference: str, payment: Optional[dict] = None) -> Optional[dict]:
    """Credit a verified donation once and return the resulting campaign ledger state."""
    payment = payment or {}
    accounted_at = datetime.now(timezone.utc)
    row = await supabase_db.query_one(
        APPLY_PAID_SQL,
        reference,
        payment.get("verified_amount_kobo"),
        payment.get("provider_transaction_id"),
        payment.get("payment_channel"),
        payment.get("provider_fee_kobo"),
        _timestamp(payment.get("provider_paid_at")),
        accounted_at,
    )
    already = row is None
    if already:
        row = await supabase_db.query_one(ALREADY_PAID_SQL, reference)
    return ({**row, "already": already} if row else None)
