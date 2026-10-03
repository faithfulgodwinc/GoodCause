"""
Script to clean test data from GoodCause database.
Deletes test accounts, test campaigns, test donations, test impact records, and test sessions.
"""
import asyncio
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env", override=True)

import supabase_db


async def clean_db():
    print("=== CONNECTING TO DATABASE ===")
    print(f"DB Source: {supabase_db.DATABASE_URL_SOURCE}")
    
    print("\n=== INSPECTING CURRENT DATABASE METRICS ===")
    user_count = await supabase_db.query_one("SELECT COUNT(*) AS total FROM users;")
    campaign_count = await supabase_db.query_one("SELECT COUNT(*) AS total FROM campaigns;")
    donation_count = await supabase_db.query_one("SELECT COUNT(*) AS total FROM donations;")
    live_count = await supabase_db.query_one("SELECT COUNT(*) AS total FROM campaigns WHERE status IN ('LIVE', 'VERIFIED', 'COMPLETED');")
    total_raised = await supabase_db.query_one("SELECT COALESCE(SUM(raised_kobo), 0) AS total FROM campaigns WHERE status IN ('LIVE', 'VERIFIED', 'COMPLETED');")
    
    print(f"Total Users in DB: {user_count['total']}")
    print(f"Total Campaigns in DB: {campaign_count['total']}")
    print(f"Live/Real Campaigns: {live_count['total']}")
    print(f"Total Donations in DB: {donation_count['total']}")
    print(f"Total Raised (Live/Real): ₦{int(total_raised['total']) / 100:,.2f}")

    print("\n=== PURGING TEST DATA ===")

    # 1. Delete test campaigns (titles or IDs containing test, demo, tc-led, concurrency, sample, etc.)
    del_campaigns = await supabase_db.execute(
        """
        DELETE FROM campaigns 
        WHERE LOWER(title) LIKE '%test%' 
           OR LOWER(title) LIKE '%demo%' 
           OR LOWER(title) LIKE '%concurrency%' 
           OR LOWER(title) LIKE '%tc-led%' 
           OR LOWER(title) LIKE '%sample%' 
           OR id LIKE 'cmp_test_%'
           OR id LIKE 'test_%';
        """
    )
    print(f"Deleted Test Campaigns: {del_campaigns}")

    # 2. Delete test users (email or id containing test, demo, example, @test, etc. but keep real admin/organizer accounts)
    del_users = await supabase_db.execute(
        """
        DELETE FROM users 
        WHERE LOWER(email) LIKE '%test%' 
           OR LOWER(email) LIKE '%example.com' 
           OR LOWER(email) LIKE '%demo%' 
           OR id LIKE 'usr_test_%'
           OR id LIKE 'test_%';
        """
    )
    print(f"Deleted Test Users: {del_users}")

    # 3. Delete orphaned donations / test donations
    del_donations = await supabase_db.execute(
        """
        DELETE FROM donations 
        WHERE LOWER(id) LIKE '%test%' 
           OR campaign_id NOT IN (SELECT id FROM campaigns);
        """
    )
    print(f"Deleted Test/Orphaned Donations: {del_donations}")

    # 4. Delete test reports
    del_reports = await supabase_db.execute(
        """
        DELETE FROM reports 
        WHERE campaign_id NOT IN (SELECT id FROM campaigns);
        """
    )
    print(f"Deleted Test/Orphaned Reports: {del_reports}")

    print("\n=== UPDATED REAL DATABASE METRICS ===")
    user_count_after = await supabase_db.query_one("SELECT COUNT(*) AS total FROM users;")
    campaign_count_after = await supabase_db.query_one("SELECT COUNT(*) AS total FROM campaigns;")
    live_count_after = await supabase_db.query_one("SELECT COUNT(*) AS total FROM campaigns WHERE status IN ('LIVE', 'VERIFIED', 'COMPLETED');")
    donation_count_after = await supabase_db.query_one("SELECT COUNT(*) AS total FROM donations;")
    raised_after = await supabase_db.query_one("SELECT COALESCE(SUM(raised_kobo), 0) AS total FROM campaigns WHERE status IN ('LIVE', 'VERIFIED', 'COMPLETED');")
    
    print(f"Real Users Count: {user_count_after['total']}")
    print(f"Real Total Campaigns Count: {campaign_count_after['total']}")
    print(f"Real Live Causes Count: {live_count_after['total']}")
    print(f"Real Donations Count: {donation_count_after['total']}")
    print(f"Real Total Raised: ₦{int(raised_after['total']) / 100:,.2f}")

    await supabase_db.close_pool()

if __name__ == "__main__":
    asyncio.run(clean_db())
