"""
Script to list all campaigns and suspend/hide test campaigns in production database.
Usage:
  python backend/hide_test_campaigns.py --list
  python backend/hide_test_campaigns.py --suspend <campaign_id>
  python backend/hide_test_campaigns.py --suspend-all-test
"""
import asyncio
import sys
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from supabase_adapter import db


async def list_campaigns():
    docs = await db.campaigns.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    print("\n--- CAMPAIGNS IN DATABASE ---")
    if not docs:
        print("No campaigns found.")
        return
    for c in docs:
        print(f"ID: {c.get('id')} | Status: {c.get('status')} | Title: {c.get('title')}")


async def suspend_campaign(campaign_id: str):
    res = await db.campaigns.update_one({"id": campaign_id}, {"$set": {"status": "SUSPENDED"}})
    print(f"Campaign '{campaign_id}' status updated to SUSPENDED (Hidden from production).")


async def suspend_test_campaigns():
    docs = await db.campaigns.find({}, {"_id": 0}).to_list(500)
    count = 0
    for c in docs:
        title = (c.get("title") or "").lower()
        if "test" in title or "demo" in title:
            await db.campaigns.update_one({"id": c["id"]}, {"$set": {"status": "SUSPENDED"}})
            print(f"Suspended test campaign: {c['id']} - {c.get('title')}")
            count += 1
    print(f"\nCompleted: {count} test campaign(s) suspended / hidden from production.")


async def main():
    if len(sys.argv) > 1:
        cmd = sys.argv[1]
        if cmd == "--list":
            await list_campaigns()
        elif cmd == "--suspend" and len(sys.argv) > 2:
            cid = sys.argv[2]
            await suspend_campaign(cid)
        elif cmd == "--suspend-all-test":
            await suspend_test_campaigns()
        else:
            print("Usage:\n  python backend/hide_test_campaigns.py --list\n  python backend/hide_test_campaigns.py --suspend <ID>\n  python backend/hide_test_campaigns.py --suspend-all-test")
    else:
        await list_campaigns()

if __name__ == "__main__":
    asyncio.run(main())
