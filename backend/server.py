from fastapi import FastAPI, APIRouter, Depends
from starlette.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import logging

from core import db, get_current_user_optional, track
import routes_auth, routes_campaigns, routes_donations, routes_social, routes_admin, routes_media, routes_payouts, routes_share, routes_impact, routes_fan_zone
from seed import seed
from payments import provider_mode
from storage import init_storage
from google_oauth_config import google_client_ids

import os
from urllib.parse import urlparse
from contextlib import asynccontextmanager
import supabase_db

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("goodcause")

@asynccontextmanager
async def lifespan(app: FastAPI):
    import supabase_db
    db_meta = supabase_db.database_url_metadata()
    logger.info(
        "Database config: source=%s host=%s port=%s is_pooler=%s is_localhost=%s",
        db_meta["source"],
        db_meta["host"],
        db_meta["port"],
        db_meta["is_pooler"],
        db_meta["is_localhost"],
    )
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
                "Run multiple active campaigns",
                "Supporter thank-you tools",
                "Campaign updates",
                "Campaign QR sharing",
            ],
        },
    }


def _origin_from_url(url: str) -> str:
    parsed = urlparse(url)
    if not parsed.scheme or not parsed.netloc:
        return ""
    return f"{parsed.scheme}://{parsed.netloc}"


def _client_id_label(client_id: str) -> str:
    if ".apps.googleusercontent.com" not in client_id:
        return client_id
    project, rest = client_id.split("-", 1)
    return f"{project}-{rest[:6]}...{rest[-32:]}"


@meta.get("/debug/oauth")
async def oauth_debug():
    return {
        "google_client_ids": [_client_id_label(client_id) for client_id in google_client_ids()],
        "allowed_origins": allowed_origins,
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
app.include_router(routes_media.router)
app.include_router(routes_payouts.router)
app.include_router(routes_share.router)
app.include_router(routes_impact.router)
app.include_router(routes_fan_zone.router)

# Compute allowed origins for CORS
allowed_origins = [
    "http://localhost:8081",
    "http://127.0.0.1:8081",
    "http://localhost:8082",
    "exp://localhost:8081",
    "https://goodcause-eight.vercel.app",
    "https://goodcause.app",
    "https://www.goodcause.app"
]
frontend_url = os.environ.get("FRONTEND_RETURN_URL", "")
if frontend_url.startswith("http"):
    origin = _origin_from_url(frontend_url)
    if origin:
        allowed_origins.append(origin)
allowed_origins = list(dict.fromkeys(allowed_origins))

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=allowed_origins,
    allow_origin_regex=r".*",
    allow_methods=["*"],
    allow_headers=["*"],
)
