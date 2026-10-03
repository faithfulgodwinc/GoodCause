"""
Script to purge all seed and test data from Supabase/PostgreSQL database.
Resets users, campaigns, donations, and impact metrics to reflect only real production data.
"""
import asyncio
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env", override=True)

import supabase_db


async def purge_data():
    print("Connecting to Supabase PostgreSQL database...")
    print(f"Database URL source: {supabase_db.DATABASE_URL_SOURCE}")

    # Inspect before count
    users_before = await supabase_db.query_one("SELECT COUNT(*) AS total FROM users;")
    campaigns_before = await supabase_db.query_one("SELECT COUNT(*) AS total FROM campaigns;")
    donations_before = await supabase_db.query_one("SELECT COUNT(*) AS total FROM donations;")
    raised_before = await supabase_db.query_one("SELECT COALESCE(SUM(raised_kobo), 0) AS total FROM campaigns;")

    print("\n--- BEFORE PURGE METRICS ---")
    print(f"Users Count: {users_before['total']}")
    print(f"Campaigns Count: {campaigns_before['total']}")
    print(f"Donations Count: {donations_before['total']}")
    print(f"Total Raised: NGN {int(raised_before['total']) / 100:,.2f}")

    print("\n--- EXECUTING PURGE OF TEST DATA ---")

    # 1. Truncate / delete test donations
    del_donations = await supabase_db.execute("DELETE FROM donations WHERE LOWER(id) LIKE '%test%' OR LOWER(id) LIKE '%seed%' OR LOWER(id) LIKE '%don_%' OR campaign_id LIKE '%cmp_%';")
    print(f"Deleted Donations: {del_donations}")

    # 2. Truncate / delete test campaigns
    del_campaigns = await supabase_db.execute("DELETE FROM campaigns WHERE id LIKE 'cmp_%' OR id LIKE 'test_%' OR LOWER(title) LIKE '%test%' OR LOWER(title) LIKE '%amaka%' OR LOWER(title) LIKE '%ilupeju%' OR LOWER(title) LIKE '%lokoja%' OR LOWER(title) LIKE '%zainab%' OR LOWER(title) LIKE '%otuoke%' OR LOWER(title) LIKE '%bakery%' OR LOWER(title) LIKE '%futo%' OR LOWER(title) LIKE '%okoro%' OR LOWER(title) LIKE '%lekki%';")
    print(f"Deleted Campaigns: {del_campaigns}")

    # 3. Truncate / delete test users (keep only main admin email faithfulgodwinc@gmail.com if needed)
    del_users = await supabase_db.execute("DELETE FROM users WHERE email NOT IN ('faithfulgodwinc@gmail.com') AND (email LIKE '%@example.com' OR email LIKE '%test%' OR email LIKE '%goodcause.ng' OR email LIKE '%@goodcause.%');")
    print(f"Deleted Users: {del_users}")

    # 4. Clear test impact ledgers and reports
    await supabase_db.execute("DELETE FROM reports;")
    await supabase_db.execute("DELETE FROM verification_checks;")
    await supabase_db.execute("DELETE FROM user_sessions WHERE user_id NOT IN (SELECT id FROM users);")

    # Inspect after count
    users_after = await supabase_db.query_one("SELECT COUNT(*) AS total FROM users;")
    campaigns_after = await supabase_db.query_one("SELECT COUNT(*) AS total FROM campaigns;")
    donations_after = await supabase_db.query_one("SELECT COUNT(*) AS total FROM donations;")
    live_after = await supabase_db.query_one("SELECT COUNT(*) AS total FROM campaigns WHERE status IN ('LIVE', 'VERIFIED', 'COMPLETED');")
    raised_after = await supabase_db.query_one("SELECT COALESCE(SUM(raised_kobo), 0) AS total FROM campaigns WHERE status IN ('LIVE', 'VERIFIED', 'COMPLETED');")

    print("\n--- AFTER PURGE METRICS (REAL DB) ---")
    print(f"Real Users Count: {users_after['total']}")
    print(f"Real Total Campaigns Count: {campaigns_after['total']}")
    print(f"Real Live Causes Count: {live_after['total']}")
    print(f"Real Donations Count: {donations_after['total']}")
    print(f"Real Total Raised: NGN {int(raised_after['total']) / 100:,.2f}")

    await supabase_db.close_pool()

if __name__ == "__main__":
    asyncio.run(purge_data())
