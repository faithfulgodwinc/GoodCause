"""Supabase PostgreSQL Async Data Access Layer for GoodCause."""
import os
import json
import uuid
import bcrypt
import jwt
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
import asyncpg
from dotenv import load_dotenv
from pathlib import Path
from urllib.parse import urlparse

ROOT_DIR = Path(__file__).parent
_EXPLICIT_DATABASE_URL = os.environ.get("DATABASE_URL")
_EXPLICIT_SUPABASE_DB_URL = os.environ.get("SUPABASE_DB_URL")
load_dotenv(ROOT_DIR / ".env")

DATABASE_URL = (
    _EXPLICIT_DATABASE_URL
    or _EXPLICIT_SUPABASE_DB_URL
    or os.environ.get("DATABASE_URL")
    or os.environ.get("SUPABASE_DB_URL")
    or "postgresql://postgres:postgres@localhost:5432/goodcause"
)
DATABASE_URL_SOURCE = (
    "DATABASE_URL"
    if _EXPLICIT_DATABASE_URL or os.environ.get("DATABASE_URL")
    else "SUPABASE_DB_URL"
    if _EXPLICIT_SUPABASE_DB_URL or os.environ.get("SUPABASE_DB_URL")
    else "fallback"
)
JWT_SECRET = os.environ.get("JWT_SECRET", "goodcause_super_secret_jwt_key_2026_nigeria_trusted")

_pool: Optional[asyncpg.Pool] = None

async def get_pool() -> asyncpg.Pool:
    global _pool
    try:
        current_loop = asyncio.get_running_loop()
    except RuntimeError:
        current_loop = None

    if _pool is None or _pool._loop.is_closed() or (current_loop and _pool._loop is not current_loop):
        if _pool is not None and not _pool._loop.is_closed():
            try:
                await _pool.close()
            except Exception:
                pass
        _pool = await asyncpg.create_pool(
            DATABASE_URL,
            min_size=1,
            max_size=10,
            command_timeout=25,
            statement_cache_size=0, # Recommended for Supabase pooler (transaction mode / pgbouncer)
        )
    return _pool

async def close_pool():
    global _pool
    if _pool:
        await _pool.close()
        _pool = None

def now() -> datetime:
    return datetime.now(timezone.utc)

def now_iso() -> str:
    return now().isoformat()

def uid(prefix: str = "") -> str:
    return f"{prefix}{uuid.uuid4().hex[:16]}"

def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False

def create_jwt(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "iat": int(now().timestamp()),
        "exp": int((now() + timedelta(days=7)).timestamp()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

# Database Query Helper
async def query(sql: str, *args) -> List[Dict[str, Any]]:
    global _pool
    for attempt in range(2):
        try:
            pool = await get_pool()
            async with pool.acquire() as conn:
                records = await conn.fetch(sql, *args)
                return [dict(r) for r in records]
        except (asyncpg.exceptions.ConnectionDoesNotExistError, ConnectionResetError, OSError):
            if _pool:
                try:
                    await _pool.close()
                except Exception:
                    pass
                _pool = None
            if attempt == 1:
                raise

async def query_one(sql: str, *args) -> Optional[Dict[str, Any]]:
    global _pool
    for attempt in range(2):
        try:
            pool = await get_pool()
            async with pool.acquire() as conn:
                record = await conn.fetchrow(sql, *args)
                return dict(record) if record else None
        except (asyncpg.exceptions.ConnectionDoesNotExistError, ConnectionResetError, OSError):
            if _pool:
                try:
                    await _pool.close()
                except Exception:
                    pass
                _pool = None
            if attempt == 1:
                raise

async def execute(sql: str, *args) -> str:
    global _pool
    for attempt in range(2):
        try:
            pool = await get_pool()
            async with pool.acquire() as conn:
                return await conn.execute(sql, *args)
        except (asyncpg.exceptions.ConnectionDoesNotExistError, ConnectionResetError, OSError):
            if _pool:
                try:
                    await _pool.close()
                except Exception:
                    pass
                _pool = None
            if attempt == 1:
                raise

def database_url_metadata() -> Dict[str, Any]:
    parsed = urlparse(DATABASE_URL)
    host = parsed.hostname or ""
    return {
        "source": DATABASE_URL_SOURCE,
        "host": host,
        "port": parsed.port,
        "database": parsed.path.lstrip("/") if parsed.path else "",
        "is_pooler": "pooler.supabase.com" in host,
        "is_localhost": host in {"localhost", "127.0.0.1"},
    }
