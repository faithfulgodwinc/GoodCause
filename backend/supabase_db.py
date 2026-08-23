"""Supabase PostgreSQL Async Data Access Layer for GoodCause."""
import os
import json
import uuid
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
import asyncpg
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://postgres.rbxoajdceezxcyqfbylj:Thisisfaithful2006.@aws-0-eu-central-1.pooler.supabase.com:6543/postgres")
JWT_SECRET = os.environ.get("JWT_SECRET", "goodcause_super_secret_jwt_key_2026_nigeria_trusted")

_pool: Optional[asyncpg.Pool] = None

async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
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
    pool = await get_pool()
    async with pool.acquire() as conn:
        records = await conn.fetch(sql, *args)
        return [dict(r) for r in records]

async def query_one(sql: str, *args) -> Optional[Dict[str, Any]]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        record = await conn.fetchrow(sql, *args)
        return dict(record) if record else None

async def execute(sql: str, *args) -> str:
    pool = await get_pool()
    async with pool.acquire() as conn:
        return await conn.execute(sql, *args)
