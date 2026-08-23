from fastapi import FastAPI, APIRouter, Depends
from starlette.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import logging

from core import db, get_current_user_optional, track
import routes_auth, routes_campaigns, routes_donations, routes_social, routes_admin, ai_assistant
from seed import seed
from payments import provider_mode

app = FastAPI(title="GoodCause API")

meta = APIRouter(prefix="/api", tags=["meta"])


@meta.get("/")
async def root():
    return {"app": "GoodCause", "status": "ok", "tagline": "Trust makes generosity go further."}


@meta.get("/config")
async def config():
    return {
        "currency": "NGN", "locale": "en-NG", "payment_mode": provider_mode(),
        "pro": {
            "entitlement": "pro",
            "features": [
                "Advanced campaign analytics", "Run multiple active campaigns",
                "Advanced supporter management", "AI Campaign Assistant",
                "Campaign customization", "Scheduled updates",
                "Advanced share assets", "Campaign QR kit",
            ],
        },
    }


class TrackIn(BaseModel):
    event: str
    props: Optional[dict] = None


@meta.post("/analytics/track")
async def analytics_track(body: TrackIn, user: Optional[dict] = Depends(get_current_user_optional)):
    await track(body.event, user["id"] if user else None, body.props)
    return {"ok": True}


app.include_router(meta)
app.include_router(routes_auth.router)
app.include_router(routes_campaigns.router)
app.include_router(routes_donations.router)
app.include_router(routes_social.router)
app.include_router(routes_admin.router)
app.include_router(ai_assistant.router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("goodcause")


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.user_sessions.create_index("session_token", unique=True)
    await db.campaigns.create_index("organizer_id")
    await db.campaigns.create_index("status")
    await db.campaigns.create_index("category_id")
    await db.donations.create_index("reference", unique=True)
    await db.donations.create_index("campaign_id")
    await db.donations.create_index("donor_id")
    await db.notifications.create_index("user_id")
    await db.campaign_followers.create_index([("campaign_id", 1), ("user_id", 1)])
    await db.saved_campaigns.create_index([("campaign_id", 1), ("user_id", 1)])
    try:
        await seed()
        logger.info("Seed complete.")
    except Exception as e:
        logger.exception("Seed failed: %s", e)


@app.on_event("shutdown")
async def shutdown():
    db.client.close()
