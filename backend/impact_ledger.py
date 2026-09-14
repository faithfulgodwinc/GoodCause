"""Atomic PostgreSQL operations for Impact Commitment distributions."""

from typing import Optional

import supabase_db


APPLY_IMPACT_PAYMENT_SQL = """
WITH claimed AS (
    UPDATE impact_allocations AS allocation
       SET status = 'PAID', payment_reference = $2, paid_at = NOW(), updated_at = NOW()
      FROM campaigns AS campaign, impact_periods AS period
     WHERE allocation.id = $1
       AND allocation.status = 'ALLOCATED'
       AND campaign.id = allocation.campaign_id
       AND period.id = allocation.period_id
       AND period.status IN ('APPROVED', 'PUBLISHED')
       AND campaign.raised_kobo + allocation.amount_kobo <= campaign.goal_kobo
 RETURNING allocation.*
), credited AS (
    UPDATE campaigns AS campaign
       SET raised_kobo = campaign.raised_kobo + claimed.amount_kobo,
           status = CASE
               WHEN campaign.raised_kobo + claimed.amount_kobo >= campaign.goal_kobo
               THEN 'COMPLETED' ELSE campaign.status END,
           updated_at = NOW()
      FROM claimed
     WHERE campaign.id = claimed.campaign_id
 RETURNING campaign.id AS campaign_id, campaign.raised_kobo,
           campaign.goal_kobo, claimed.id AS allocation_id,
           claimed.amount_kobo, claimed.payment_reference
)
SELECT * FROM credited
"""


ALREADY_PAID_SQL = """
SELECT allocation.id AS allocation_id, allocation.campaign_id,
       allocation.amount_kobo, allocation.payment_reference,
       campaign.raised_kobo, campaign.goal_kobo
  FROM impact_allocations allocation
  JOIN campaigns campaign ON campaign.id = allocation.campaign_id
 WHERE allocation.id = $1 AND allocation.status = 'PAID'
"""


def payment_sql_is_atomic() -> bool:
    normalized = " ".join(APPLY_IMPACT_PAYMENT_SQL.upper().split())
    return normalized.startswith("WITH CLAIMED AS") and "UPDATE IMPACT_ALLOCATIONS" in normalized and "UPDATE CAMPAIGNS" in normalized


async def apply_impact_payment(allocation_id: str, payment_reference: str) -> Optional[dict]:
    if not payment_reference.strip():
        raise ValueError("Payment reference is required")
    row = await supabase_db.query_one(APPLY_IMPACT_PAYMENT_SQL, allocation_id, payment_reference.strip())
    if row:
        return {**row, "already": False}
    paid = await supabase_db.query_one(ALREADY_PAID_SQL, allocation_id)
    return ({**paid, "already": True} if paid else None)
