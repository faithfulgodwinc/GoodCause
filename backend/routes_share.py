"""Public share pages used by social crawlers and shared links."""

from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse

from campaign_share import render_campaign_share_html, render_fan_zone_share_html
from core import db
import supabase_db


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
    count_row = await supabase_db.query_one(
        "SELECT COUNT(*) AS cnt FROM fan_gifts WHERE recipient_id = $1 AND status = 'paid'",
        user_id,
    )
    supporters_count = int(count_row["cnt"]) if count_row else 0

    total_row = await supabase_db.query_one(
        "SELECT COALESCE(SUM(amount_kobo), 0) AS total FROM fan_gifts WHERE recipient_id = $1 AND status = 'paid'",
        user_id,
    )
    total_kobo = int(total_row["total"]) if total_row else 0

    zone_data = {
        "headline": zone.get("headline"),
        "cover_image": zone.get("cover_image"),
        "profile_picture": zone.get("profile_picture"),
        "supporters_count": supporters_count,
        "total_received_kobo": total_kobo,
    }
    return HTMLResponse(
        render_fan_zone_share_html(user, zone_data),
        headers={"Cache-Control": "public, max-age=120, s-maxage=120"},
    )
