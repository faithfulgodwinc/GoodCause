from fastapi import FastAPI, APIRouter, Depends
from starlette.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import logging

from core import db, get_current_user_optional, track
import routes_auth, routes_campaigns, routes_donations, routes_social, routes_admin, ai_assistant, routes_media, routes_payouts
from seed import seed
from payments import provider_mode
from storage import init_storage

import os
from urllib.parse import urlparse
from contextlib import asynccontextmanager

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("goodcause")

@asynccontextmanager
async def lifespan(app: FastAPI):
    import supabase_db
    try:
        await supabase_db.get_pool()
        logger.info("Supabase PostgreSQL pool connected successfully.")
    except Exception as e:
        logger.exception("Supabase pool connection failed: %s", e)
    try:
        init_storage()
        logger.info("Object storage ready.")
    except Exception as e:
        logger.warning("Object storage init deferred: %s", e)
    
    yield
    
    await supabase_db.close_pool()

app = FastAPI(title="GoodCause API", lifespan=lifespan)
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
app.include_router(routes_media.router)
app.include_router(routes_payouts.router)

# Compute allowed origins for CORS
allowed_origins = [
    "http://localhost:8081",
    "http://127.0.0.1:8081",
    "exp://localhost:8081"
]
frontend_url = os.environ.get("FRONTEND_RETURN_URL", "")
if frontend_url.startswith("http"):
    parsed = urlparse(frontend_url)
    allowed_origins.append(f"{parsed.scheme}://{parsed.netloc}")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https://.*\.vercel\.app|http://localhost:.*|http://127\.0\.0\.1:.*",
    allow_methods=["*"],
    allow_headers=["*"],
)
