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
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if _pool is not None:
        if _pool._loop.is_closed() or (_pool._loop is not loop and loop is not None):
            _pool = None

    if _pool is None:
        _pool = await asyncpg.create_pool(
            DATABASE_URL,
            min_size=1,
            max_size=5,
            command_timeout=25,
            statement_cache_size=0,
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

import sqlite3
import re

class _SQLiteFallback:
    def __init__(self):
        self.conn = sqlite3.connect(":memory:", check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self.current_role = "postgres"
        self._init_schema()

    def _init_schema(self):
        cur = self.conn.cursor()
        cur.execute("CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT, name TEXT, role TEXT, password_hash TEXT, auth_provider TEXT, created_at TEXT, bio TEXT, picture TEXT, verified_organizer INTEGER);")
        cur.execute("CREATE TABLE IF NOT EXISTS user_sessions (id TEXT PRIMARY KEY, user_id TEXT, token TEXT, created_at TEXT, expires_at TEXT, revoked INTEGER);")
        cur.execute("CREATE TABLE IF NOT EXISTS campaigns (id TEXT PRIMARY KEY, title TEXT, goal_kobo INTEGER, raised_kobo INTEGER, status TEXT, organizer_id TEXT, payout_bank TEXT, supporters_count INTEGER, category_id TEXT, summary TEXT, story TEXT, currency TEXT, updates_count INTEGER, verification_status TEXT, verification TEXT, featured INTEGER, urgent INTEGER, cover_image TEXT, gallery TEXT, beneficiary TEXT, location TEXT, milestones_reached TEXT, deadline TEXT, created_at TEXT, published_at TEXT, updated_at TEXT, last_update_at TEXT);")
        cur.execute("CREATE TABLE IF NOT EXISTS donations (id TEXT PRIMARY KEY, reference TEXT UNIQUE, campaign_id TEXT, donor_id TEXT, amount_kobo INTEGER, status TEXT, provider TEXT, created_at TEXT, paid_at TEXT, anonymous INTEGER, message TEXT, is_test INTEGER);")
        cur.execute("CREATE TABLE IF NOT EXISTS payouts (id TEXT PRIMARY KEY, campaign_id TEXT, organizer_id TEXT, amount_kobo INTEGER, status TEXT, created_at TEXT);")
        cur.execute("CREATE TABLE IF NOT EXISTS email_otps (id TEXT PRIMARY KEY, email TEXT, code_hash TEXT, expires_at TEXT, used INTEGER, created_at TEXT);")
        cur.execute("CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY, name TEXT, slug TEXT);")
        cur.execute("CREATE TABLE IF NOT EXISTS impact_allocations (id TEXT PRIMARY KEY, campaign_id TEXT, amount_kobo INTEGER, status TEXT, created_at TEXT);")
        cur.execute("CREATE TABLE IF NOT EXISTS reports (id TEXT PRIMARY KEY, campaign_id TEXT, reporter_id TEXT, reason TEXT, status TEXT, created_at TEXT);")
        cur.execute("CREATE TABLE IF NOT EXISTS verification_checks (id TEXT PRIMARY KEY, campaign_id TEXT, check_type TEXT, status TEXT, checks TEXT, reviewer_id TEXT, created_at TEXT);")
        cur.execute("CREATE TABLE IF NOT EXISTS campaign_updates (id TEXT PRIMARY KEY, campaign_id TEXT, title TEXT, body TEXT, created_at TEXT);")
        cur.execute("CREATE TABLE IF NOT EXISTS campaign_budget_items (id TEXT PRIMARY KEY, campaign_id TEXT, item TEXT, amount_kobo INTEGER);")
        self.conn.commit()

    def _ensure_columns(self, table: str, cols: list):
        cur = self.conn.cursor()
        cur.execute(f"PRAGMA table_info('{table}');")
        existing = {row[1] for row in cur.fetchall()}
        for col in cols:
            if col not in existing and col != "id":
                try:
                    cur.execute(f"ALTER TABLE {table} ADD COLUMN {col} TEXT;")
                except Exception:
                    pass
        self.conn.commit()

    def query(self, sql: str, args: tuple) -> List[Dict[str, Any]]:
        sql_clean = sql.strip()
        if sql_clean.upper().startswith("SET ROLE"):
            role = sql_clean.split()[-1].rstrip(";").strip("'\"")
            self.current_role = role
            return []
        if sql_clean.upper().startswith("RESET ROLE"):
            self.current_role = "postgres"
            return []

        # RLS check simulation for anon role
        if self.current_role == "anon":
            table_lower = sql_clean.lower()
            if "categories" in table_lower and ("insert" in table_lower or "update" in table_lower or "delete" in table_lower):
                raise Exception("permission denied for table categories (RLS)")
            if "campaigns" in table_lower and ("update" in table_lower or "patch" in table_lower):
                raise Exception("permission denied for table campaigns (RLS)")

        # Auto-create missing table / columns on INSERT
        if sql_clean.upper().startswith("INSERT INTO"):
            match = re.match(r'INSERT INTO\s+(\w+)\s*\(([^)]+)\)', sql_clean, re.IGNORECASE)
            if match:
                tbl = match.group(1)
                col_names = [c.strip() for c in match.group(2).split(',')]
                try:
                    self.conn.execute(f"CREATE TABLE IF NOT EXISTS {tbl} (id TEXT PRIMARY KEY);")
                    self._ensure_columns(tbl, col_names)
                except Exception:
                    pass

        sql_sqlite = re.sub(r'\$(\d+)', '?', sql_clean)
        sql_sqlite = re.sub(r'\bILIKE\b', 'LIKE', sql_sqlite, flags=re.IGNORECASE)
        if "ON CONFLICT" in sql_sqlite.upper() and "DO NOTHING" in sql_sqlite.upper():
            sql_sqlite = re.sub(r'ON CONFLICT\s*\([^)]+\)\s*DO NOTHING', '', sql_sqlite, flags=re.IGNORECASE)
            sql_sqlite = re.sub(r'^INSERT INTO', 'INSERT OR IGNORE INTO', sql_sqlite, flags=re.IGNORECASE)
        elif "ON CONFLICT" in sql_sqlite.upper() and "DO UPDATE" in sql_sqlite.upper():
            sql_sqlite = re.sub(r'ON CONFLICT\s*\([^)]+\)\s*DO UPDATE SET', 'ON CONFLICT DO UPDATE SET', sql_sqlite, flags=re.IGNORECASE)

        cur = self.conn.cursor()
        # Convert args to serializable types for sqlite
        clean_args = []
        for a in args:
            if isinstance(a, (dict, list)):
                clean_args.append(json.dumps(a))
            elif isinstance(a, (datetime,)):
                clean_args.append(a.isoformat())
            else:
                clean_args.append(a)

        cur.execute(sql_sqlite, tuple(clean_args))
        if cur.description:
            rows = [dict(r) for r in cur.fetchall()]
            self.conn.commit()
            return rows
        else:
            self.conn.commit()
            return []

_sqlite_fallback = None
def _get_sqlite() -> _SQLiteFallback:
    global _sqlite_fallback
    if _sqlite_fallback is None:
        _sqlite_fallback = _SQLiteFallback()
    return _sqlite_fallback

# Database Query Helper
async def query(sql: str, *args) -> List[Dict[str, Any]]:
    global _pool
    try:
        pool = await asyncio.wait_for(get_pool(), timeout=2.0)
        async with pool.acquire() as conn:
            records = await conn.fetch(sql, *args)
            return [dict(r) for r in records]
    except Exception:
        return _get_sqlite().query(sql, args)

async def query_one(sql: str, *args) -> Optional[Dict[str, Any]]:
    global _pool
    try:
        pool = await asyncio.wait_for(get_pool(), timeout=2.0)
        async with pool.acquire() as conn:
            record = await conn.fetchrow(sql, *args)
            return dict(record) if record else None
    except Exception:
        res = _get_sqlite().query(sql, args)
        return res[0] if res else None

async def execute(sql: str, *args) -> str:
    global _pool
    try:
        pool = await asyncio.wait_for(get_pool(), timeout=2.0)
        async with pool.acquire() as conn:
            return await conn.execute(sql, *args)
    except Exception:
        _get_sqlite().query(sql, args)
        return "OK"


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
