"""AI Campaign Assistant — DEPRECATED & DISABLED for legal compliance."""
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api/ai", tags=["ai"])

@router.post("/campaign-assistant", deprecated=True)
async def campaign_assistant():
    raise HTTPException(status_code=410, detail="AI Campaign Assistant feature has been disabled.")

