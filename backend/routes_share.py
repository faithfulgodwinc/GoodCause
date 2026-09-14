"""Public campaign pages used by social crawlers and shared links."""

from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse

from campaign_share import render_campaign_share_html
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
