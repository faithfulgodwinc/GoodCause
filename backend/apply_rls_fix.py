import asyncio
import os
import asyncpg
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/goodcause"
)

async def apply_rls():
    sql_path = ROOT_DIR / "migrations" / "fix_supabase_rls_security.sql"
    print(f"Reading SQL from {sql_path}...")
    sql = sql_path.read_text(encoding="utf-8")
    
    print("Connecting to Supabase PostgreSQL database...")
    conn = await asyncpg.connect(DATABASE_URL, statement_cache_size=0)
    try:
        print("Applying Row Level Security (RLS) policies across all public tables...")
        await conn.execute(sql)
        print("SUCCESS: Row Level Security (RLS) has been enabled on all public tables!")
        print("SUCCESS: Sensitive user data, sessions, OTPs, and bank accounts are now protected.")
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(apply_rls())
