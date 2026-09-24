"""Public share pages used by social crawlers and shared links."""

from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse

from campaign_share import render_campaign_share_html, render_fan_zone_share_html
from core import db


router = APIRouter(tags=["sharing"])
PUBLIC_CAMPAIGN_STATUSES = {"LIVE", "COMPLETED", "PAUSED"}


@router.get("/share/campaign/{campaign_id}", response_class=HTMLResponse)
async def campaign_share_page(campaign_id: str):
    campaign = await db.campaigns.find_one({"id": campaign_id}, {"_id": 0})
    if not campaign or campaign.get("status") not in PUBLIC_CAMPAIGN_STATUSES:
        raise HTTPException(status_code=404, detail="Campaign not found.")
    return HTMLResponse(
        render_campaign_share_html(campaign),
        headers={"Cache-Control": "public, max-age=300, s-maxage=300"},
    )


@router.get("/share/fan-zone/{user_id}", response_class=HTMLResponse)
async def fan_zone_share_page(user_id: str):
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    zone = await db.fan_zones.find_one({"user_id": user_id}, {"_id": 0})
    if not zone or not zone.get("enabled", True):
        raise HTTPException(status_code=404, detail="Fan Zone not found.")

    # Fetch live stats so the social card shows real supporter counts
    supporters_count = await db.fan_gifts.count_documents({"recipient_id": user_id, "status": "paid"})
    total_agg = await db.fan_gifts.aggregate([
        {"$match": {"recipient_id": user_id, "status": "paid"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount_kobo"}}},
    ]).to_list(1)
    total_kobo = total_agg[0]["total"] if total_agg else 0

    zone_data = {
        "headline": zone.get("headline"),
        "supporters_count": supporters_count,
        "total_received_kobo": total_kobo,
    }
    return HTMLResponse(
        render_fan_zone_share_html(user, zone_data),
        headers={"Cache-Control": "public, max-age=120, s-maxage=120"},
    )
