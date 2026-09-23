import asyncio
import os
import asyncpg
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://postgres.rbxoajdceezxcyqfbylj:Thisisfaithful2006.@aws-0-eu-central-1.pooler.supabase.com:6543/postgres")

async def inspect():
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        rows = await conn.fetch("SELECT id, title, status, verification_status, featured, urgent FROM campaigns;")
        print(f"Total campaigns in DB: {len(rows)}")
        for r in rows:
            print(f"- ID: {r['id']} | Title: {r['title']} | status: {r['status']} | verification_status: {r['verification_status']} | featured: {r['featured']} | urgent: {r['urgent']}")
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(inspect())
