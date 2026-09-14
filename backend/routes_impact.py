"""Impact Commitment administration and public transparency routes."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

import supabase_db
from core import require_admin, uid
from impact_ledger import apply_impact_payment
from impact_policy import allocate_equally, split_net_proceeds


router = APIRouter(prefix="/api", tags=["impact"])

NEXT_STATE = {
    "DRAFT": "CALCULATED",
    "CALCULATED": "APPROVED",
    "APPROVED": "PUBLISHED",
    "PUBLISHED": "CLOSED",
}


def settlement_totals(apple_kobo: int, google_kobo: int, adjustments_kobo: int = 0) -> dict:
    net = apple_kobo + google_kobo + adjustments_kobo
    if net < 0:
        raise ValueError("Settlement adjustments cannot make net proceeds negative")
    impact, operations = split_net_proceeds(net)
    return {
        "net_proceeds_kobo": net,
        "current_impact_kobo": impact,
        "operating_kobo": operations,
    }


def validate_transition(current: str, target: str) -> None:
    if NEXT_STATE.get(current) != target:
        raise ValueError(f"Invalid impact period transition: {current} -> {target}")


def public_period(period: dict, allocations: list[dict]) -> dict:
    safe_allocations = [{
        "campaign_id": row["campaign_id"],
        "campaign_title": row["campaign_title_snapshot"],
        "amount_kobo": row["amount_kobo"],
        "status": row["status"],
    } for row in allocations]
    return {
        "period_key": period["period_key"],
        "status": period["status"],
        "published_at": period.get("published_at"),
        "net_proceeds_kobo": period["net_proceeds_kobo"],
        "current_impact_kobo": period["current_impact_kobo"],
        "operating_kobo": period["operating_kobo"],
        "opening_rollover_kobo": period["opening_rollover_kobo"],
        "available_impact_kobo": period["available_impact_kobo"],
        "allocated_kobo": period["allocated_kobo"],
        "closing_rollover_kobo": period["closing_rollover_kobo"],
        "paid_kobo": sum(row["amount_kobo"] for row in allocations if row["status"] == "PAID"),
        "pending_kobo": sum(row["amount_kobo"] for row in allocations if row["status"] == "ALLOCATED"),
        "cancelled_kobo": sum(row["amount_kobo"] for row in allocations if row["status"] == "CANCELLED"),
        "allocations": safe_allocations,
    }


class PeriodIn(BaseModel):
    period_key: str = Field(min_length=4, max_length=32, pattern=r"^[0-9A-Za-z_-]+$")


class SettlementIn(BaseModel):
    apple_net_kobo: int = Field(ge=0)
    google_net_kobo: int = Field(ge=0)
    adjustments_kobo: int = 0
    reconciliation_reference: str = Field(min_length=1, max_length=500)
    adjustment_explanation: Optional[str] = Field(default=None, max_length=1000)


class PaymentIn(BaseModel):
    payment_reference: str = Field(min_length=1, max_length=160)


class CancellationIn(BaseModel):
    reason_code: str = Field(min_length=1, max_length=64)
    explanation: str = Field(min_length=1, max_length=1000)


async def _allocations(period_id: str) -> list[dict]:
    return await supabase_db.query(
        "SELECT * FROM impact_allocations WHERE period_id=$1 ORDER BY campaign_id", period_id
    )


@router.get("/impact/latest")
async def latest_impact():
    period = await supabase_db.query_one(
        "SELECT * FROM impact_periods WHERE status IN ('PUBLISHED','CLOSED') ORDER BY published_at DESC LIMIT 1"
    )
    if not period:
        return {"status": "pending", "report": None}
    return {"status": "published", "report": public_period(period, await _allocations(period["id"]))}


@router.get("/impact/periods")
async def impact_periods(limit: int = Query(12, ge=1, le=24), offset: int = Query(0, ge=0)):
    periods = await supabase_db.query(
        "SELECT * FROM impact_periods WHERE status IN ('PUBLISHED','CLOSED') ORDER BY published_at DESC LIMIT $1 OFFSET $2",
        limit, offset,
    )
    return [public_period(period, await _allocations(period["id"])) for period in periods]


@router.get("/impact/periods/{period_key}")
async def impact_period(period_key: str):
    period = await supabase_db.query_one(
        "SELECT * FROM impact_periods WHERE period_key=$1 AND status IN ('PUBLISHED','CLOSED')", period_key
    )
    if not period:
        raise HTTPException(status_code=404, detail="Published impact report not found.")
    return public_period(period, await _allocations(period["id"]))


@router.get("/admin/impact-periods")
async def admin_periods(admin: dict = Depends(require_admin)):
    periods = await supabase_db.query("SELECT * FROM impact_periods ORDER BY period_key DESC")
    for period in periods:
        period["allocations"] = await _allocations(period["id"])
    return periods


@router.post("/admin/impact-periods")
async def create_period(body: PeriodIn, admin: dict = Depends(require_admin)):
    try:
        return await supabase_db.query_one(
            "INSERT INTO impact_periods (id,period_key,created_by) VALUES ($1,$2,$3) RETURNING *",
            uid("ipr_"), body.period_key, admin["id"],
        )
    except Exception as exc:
        raise HTTPException(status_code=409, detail="Impact period already exists.") from exc


@router.put("/admin/impact-periods/{period_id}/settlement")
async def update_settlement(period_id: str, body: SettlementIn, admin: dict = Depends(require_admin)):
    if body.adjustments_kobo and not (body.adjustment_explanation or "").strip():
        raise HTTPException(status_code=400, detail="Adjustment explanation is required.")
    try:
        totals = settlement_totals(body.apple_net_kobo, body.google_net_kobo, body.adjustments_kobo)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    row = await supabase_db.query_one(
        """UPDATE impact_periods SET apple_net_kobo=$2,google_net_kobo=$3,adjustments_kobo=$4,
        net_proceeds_kobo=$5,current_impact_kobo=$6,operating_kobo=$7,reconciliation_reference=$8,updated_at=NOW()
        WHERE id=$1 AND status='DRAFT' RETURNING *""",
        period_id, body.apple_net_kobo, body.google_net_kobo, body.adjustments_kobo,
        totals["net_proceeds_kobo"], totals["current_impact_kobo"], totals["operating_kobo"],
        body.reconciliation_reference.strip(),
    )
    if not row:
        raise HTTPException(status_code=409, detail="Only draft periods can be edited.")
    if body.adjustments_kobo:
        await supabase_db.execute(
            "INSERT INTO impact_adjustments (id,period_id,amount_kobo,reason_code,explanation,created_by) VALUES ($1,$2,$3,'SETTLEMENT',$4,$5)",
            uid("iadj_"), period_id, body.adjustments_kobo, body.adjustment_explanation.strip(), admin["id"],
        )
    return row


@router.post("/admin/impact-periods/{period_id}/calculate")
async def calculate_period(period_id: str, admin: dict = Depends(require_admin)):
    pool = await supabase_db.get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            period_record = await conn.fetchrow("SELECT * FROM impact_periods WHERE id=$1 FOR UPDATE", period_id)
            if not period_record or period_record["status"] != "DRAFT" or not period_record["reconciliation_reference"]:
                raise HTTPException(status_code=409, detail="A reconciled draft period is required.")
            previous = await conn.fetchval(
                "SELECT closing_rollover_kobo FROM impact_periods WHERE status='CLOSED' AND period_key < $1 ORDER BY period_key DESC LIMIT 1",
                period_record["period_key"],
            ) or 0
            campaign_records = await conn.fetch(
                """SELECT id,title,goal_kobo,raised_kobo FROM campaigns
                WHERE status='LIVE' AND verification_status='VERIFIED' AND raised_kobo < goal_kobo
                AND COALESCE((payout_bank->>'verified')::boolean,FALSE)=TRUE ORDER BY id"""
            )
            campaigns = [dict(row) for row in campaign_records]
            result = allocate_equally(period_record["current_impact_kobo"] + previous, campaigns)
            for allocation in result["allocations"]:
                campaign = next(item for item in campaigns if item["id"] == allocation["campaign_id"])
                await conn.execute(
                    """INSERT INTO impact_allocations
                    (id,period_id,campaign_id,campaign_title_snapshot,remaining_goal_snapshot_kobo,amount_kobo)
                    VALUES ($1,$2,$3,$4,$5,$6)""",
                    uid("ial_"), period_id, campaign["id"], campaign["title"],
                    allocation["remaining_goal_snapshot_kobo"], allocation["amount_kobo"],
                )
            row = await conn.fetchrow(
                """UPDATE impact_periods SET status='CALCULATED',opening_rollover_kobo=$2,
                available_impact_kobo=$3,allocated_kobo=$4,closing_rollover_kobo=$5,
                calculated_at=NOW(),updated_at=NOW() WHERE id=$1 RETURNING *""",
                period_id, previous, period_record["current_impact_kobo"] + previous,
                result["allocated_kobo"], result["rollover_kobo"],
            )
    return dict(row)


async def _transition(period_id: str, current: str, target: str, admin_id: str) -> dict:
    validate_transition(current, target)
    time_column = {"APPROVED": "approved_at", "PUBLISHED": "published_at", "CLOSED": "closed_at"}[target]
    extra = ", approved_by=$3" if target == "APPROVED" else ""
    row = await supabase_db.query_one(
        f"UPDATE impact_periods SET status=$2,{time_column}=NOW(),updated_at=NOW(){extra} WHERE id=$1 AND status='{current}' RETURNING *",
        *([period_id, target, admin_id] if target == "APPROVED" else [period_id, target]),
    )
    if not row:
        raise HTTPException(status_code=409, detail=f"Period must be {current}.")
    return row


@router.post("/admin/impact-periods/{period_id}/approve")
async def approve_period(period_id: str, admin: dict = Depends(require_admin)):
    return await _transition(period_id, "CALCULATED", "APPROVED", admin["id"])


@router.post("/admin/impact-periods/{period_id}/publish")
async def publish_period(period_id: str, admin: dict = Depends(require_admin)):
    return await _transition(period_id, "APPROVED", "PUBLISHED", admin["id"])


@router.post("/admin/impact-periods/{period_id}/close")
async def close_period(period_id: str, admin: dict = Depends(require_admin)):
    pending = await supabase_db.query_one(
        "SELECT id FROM impact_allocations WHERE period_id=$1 AND status='ALLOCATED' LIMIT 1", period_id
    )
    if pending:
        raise HTTPException(status_code=409, detail="Resolve every allocation before closing.")
    return await _transition(period_id, "PUBLISHED", "CLOSED", admin["id"])


@router.post("/admin/impact-allocations/{allocation_id}/paid")
async def mark_allocation_paid(allocation_id: str, body: PaymentIn, admin: dict = Depends(require_admin)):
    try:
        result = await apply_impact_payment(allocation_id, body.payment_reference)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not result:
        raise HTTPException(status_code=409, detail="Allocation cannot be paid or would exceed the campaign goal.")
    return result


@router.post("/admin/impact-allocations/{allocation_id}/cancel")
async def cancel_allocation(allocation_id: str, body: CancellationIn,
                            admin: dict = Depends(require_admin)):
    pool = await supabase_db.get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            allocation = await conn.fetchrow(
                """UPDATE impact_allocations AS allocation
                SET status='CANCELLED',updated_at=NOW()
                FROM impact_periods AS period
                WHERE allocation.id=$1 AND allocation.status='ALLOCATED'
                AND period.id=allocation.period_id
                AND period.status IN ('APPROVED','PUBLISHED')
                RETURNING allocation.*""", allocation_id,
            )
            if not allocation:
                raise HTTPException(status_code=409, detail="Allocation cannot be cancelled.")
            await conn.execute(
                "UPDATE impact_periods SET closing_rollover_kobo=closing_rollover_kobo+$2,updated_at=NOW() WHERE id=$1",
                allocation["period_id"], allocation["amount_kobo"],
            )
            await conn.execute(
                """INSERT INTO impact_adjustments
                (id,period_id,allocation_id,amount_kobo,reason_code,explanation,created_by)
                VALUES ($1,$2,$3,$4,$5,$6,$7)""",
                uid("iadj_"), allocation["period_id"], allocation_id,
                allocation["amount_kobo"], body.reason_code.strip(), body.explanation.strip(), admin["id"],
            )
    return {"id": allocation_id, "status": "CANCELLED", "rollover_kobo": allocation["amount_kobo"]}
