"""Seed Supabase database with categories, admin, organizers, campaigns, and initial donations."""
import random
import json
import uuid
import bcrypt
from datetime import datetime, timezone, timedelta
import os
import psycopg

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/goodcause")

def now():
    return datetime.now(timezone.utc)

def now_iso():
    return now().isoformat()

def uid(prefix=""):
    return f"{prefix}{uuid.uuid4().hex[:16]}"

def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def N(naira):
    return naira * 100

def campaign_percent(raised: int, goal: int) -> int:
    if goal <= 0:
        return 0
    return min(100, int(round(raised * 100 / goal)))

MED = "https://images.unsplash.com/photo-1631815590058-860e4f83c1e8?w=800&q=80"
SCHOOL = "https://images.unsplash.com/photo-1584750153892-38414eb8e76a?w=800&q=80"
COMMUNITY = "https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?w=800&q=80"
AVATAR = "https://images.unsplash.com/photo-1614023342667-6f060e9d1e04?w=400&q=80"

CATEGORIES = [
    {"slug": "medical", "name": "Medical", "icon": "heart", "color": "#B83A3A", "order": 1},
    {"slug": "education", "name": "Education", "icon": "book-open", "color": "#4A6E82", "order": 2},
    {"slug": "emergency", "name": "Emergency", "icon": "alert-triangle", "color": "#D99026", "order": 3},
    {"slug": "community", "name": "Community", "icon": "users", "color": "#2D7A5D", "order": 4},
    {"slug": "memorial", "name": "Memorial", "icon": "feather", "color": "#7A3520", "order": 5},
    {"slug": "business", "name": "Business", "icon": "briefcase", "color": "#C05C3D", "order": 6},
    {"slug": "environment", "name": "Environment", "icon": "sun", "color": "#2D7A5D", "order": 7},
    {"slug": "animals", "name": "Animals", "icon": "github", "color": "#5C5954", "order": 8},
    {"slug": "others", "name": "Others", "icon": "more-horizontal", "color": "#71717A", "order": 9},
]

def seed():
    print("Connecting to Supabase PostgreSQL for seeding...")
    with psycopg.connect(DATABASE_URL) as conn:
        with conn.cursor() as cur:
            # 1. Admin Users
            admins = [
                ("faithfulgodwinc@gmail.com", "Faithful Godwin", "Platform administrator"),
                ("admin@goodcause.ng", "GoodCause Admin", "Platform moderator"),
            ]
            for email, name, bio in admins:
                cur.execute("SELECT id FROM users WHERE email = %s", (email,))
                row = cur.fetchone()
                if not row:
                    cur.execute("""
                        INSERT INTO users (id, email, password_hash, name, picture, role, bio, verified_organizer, auth_provider)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """, (uid("usr_"), email, hash_password("Admin@12345"), name, None, "admin", bio, True, "password"))
                else:
                    cur.execute("UPDATE users SET role = 'admin', verified_organizer = TRUE WHERE email = %s", (email,))
            print("Admin users seeded.")

            # 2. Categories
            for c in CATEGORIES:
                cur.execute("SELECT id FROM categories WHERE slug = %s", (c["slug"],))
                if not cur.fetchone():
                    cur.execute("""
                        INSERT INTO categories (id, slug, name, icon, color, "order")
                        VALUES (%s, %s, %s, %s, %s, %s)
                    """, (uid("cat_"), c["slug"], c["name"], c["icon"], c["color"], c["order"]))
            print("Categories seeded.")

            # Check if campaigns already exist
            cur.execute("SELECT COUNT(*) FROM campaigns")
            if cur.fetchone()[0] > 0:
                print("Campaigns already exist in Supabase. Seeding complete.")
                conn.commit()
                return

            # 3. Organizers
            cur.execute("SELECT slug, id FROM categories")
            cats = {row[0]: row[1] for row in cur.fetchall()}

            organizers = []
            org_specs = [
                ("chidi@goodcause.ng", "Chidi Okafor", "Community volunteer in Owerri."),
                ("amina@goodcause.ng", "Amina Bello", "Nurse and family advocate, Abuja."),
                ("tayo@goodcause.ng", "Tayo Adeyemi", "Small business owner, Lagos."),
            ]
            for email, name, bio in org_specs:
                cur.execute("SELECT id FROM users WHERE email = %s", (email,))
                row = cur.fetchone()
                if not row:
                    oid = uid("usr_")
                    cur.execute("""
                        INSERT INTO users (id, email, password_hash, name, picture, role, bio, verified_organizer, auth_provider)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """, (oid, email, hash_password("Passw0rd!"), name, AVATAR, "donor", bio, True, "password"))
                else:
                    oid = row[0]
                organizers.append(oid)

            # 4. Campaigns
            specs = [
                dict(title="Help Amaka Walk Again", cat="medical", cover=MED, featured=True, urgent=False,
                     goal=N(5_000_000), summary="Amaka needs corrective spinal surgery to walk without pain again.",
                     beneficiary={"name": "Amaka Nwosu", "relationship": "friend", "type": "individual"},
                     budget=[("Surgery", N(3_000_000)), ("Medication", N(800_000)), ("Hospital stay", N(700_000)), ("Physiotherapy", N(500_000))],
                     city="Enugu", days=40, pct=64),
                dict(title="Rebuild Ilupeju Community School", cat="education", cover=SCHOOL, featured=True, urgent=False,
                     goal=N(8_000_000), summary="A storm destroyed three classrooms. Let's rebuild for 240 pupils.",
                     beneficiary={"name": "Ilupeju Community School", "relationship": "community", "type": "organization"},
                     budget=[("Roofing & structure", N(4_500_000)), ("Desks & chairs", N(1_500_000)), ("Books & supplies", N(1_000_000)), ("Labour", N(1_000_000))],
                     city="Ibadan", days=55, pct=38),
                dict(title="Flood Relief for Lokoja Families", cat="emergency", cover=COMMUNITY, featured=False, urgent=True,
                     goal=N(3_000_000), summary="Emergency food, clean water and shelter for 60 displaced families.",
                     beneficiary={"name": "Lokoja flood victims", "relationship": "community", "type": "community"},
                     budget=[("Food packs", N(1_200_000)), ("Clean water", N(700_000)), ("Temporary shelter", N(700_000)), ("Medical kits", N(400_000))],
                     city="Lokoja", days=8, pct=51),
                dict(title="Baby Zainab's Heart Surgery", cat="medical", cover=MED, featured=False, urgent=True,
                     goal=N(6_500_000), summary="7-month-old Zainab needs urgent open-heart surgery abroad.",
                     beneficiary={"name": "Zainab Bello", "relationship": "family", "type": "individual"},
                     budget=[("Surgery abroad", N(4_500_000)), ("Travel & visa", N(1_200_000)), ("Post-op care", N(800_000))],
                     city="Abuja", days=12, pct=88),
                dict(title="Clean Water for Otuoke", cat="community", cover=COMMUNITY, featured=False, urgent=False,
                     goal=N(4_000_000), summary="A solar borehole to give 900 residents safe drinking water.",
                     beneficiary={"name": "Otuoke community", "relationship": "community", "type": "community"},
                     budget=[("Borehole drilling", N(2_000_000)), ("Solar pump", N(1_200_000)), ("Storage tank", N(800_000))],
                     city="Otuoke", days=60, pct=29),
            ]

            names = ["Ada", "Emeka", "Fatima", "Segun", "Ngozi", "Ibrahim", "Chioma", "Bola", "Yusuf", "Grace"]

            for i, s in enumerate(specs):
                cid = uid("cmp_")
                cat_id = cats[s["cat"]]
                org_id = organizers[i % len(organizers)]
                goal = s["goal"]
                raised = int(goal * s["pct"] / 100)
                published = now() - timedelta(days=random.randint(6, 20))
                deadline = now() + timedelta(days=s["days"])
                story = f"{s['summary']}\n\nEvery contribution moves this cause forward. Together, trust makes generosity go further."
                
                verification = json.dumps({
                    "status": "VERIFIED",
                    "checks": {"identity": True, "beneficiary": True, "documents": True, "relationship": True, "updates_enabled": True},
                    "verified_at": now_iso()
                })

                cur.execute("""
                    INSERT INTO campaigns (
                        id, organizer_id, category_id, title, summary, story, goal_kobo, raised_kobo,
                        currency, supporters_count, updates_count, status, verification_status,
                        verification, featured, urgent, cover_image, gallery, beneficiary,
                        location, milestones_reached, deadline, created_at, published_at, updated_at
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s, %s,
                        %s, %s, %s, %s, %s,
                        %s, %s, %s, %s, %s, %s,
                        %s, %s, %s, %s, %s, %s
                    )
                """, (
                    cid, org_id, cat_id, s["title"], s["summary"], story, goal, 0,
                    "NGN", 0, 0, "LIVE", "VERIFIED",
                    verification, s["featured"], s["urgent"], s["cover"], json.dumps([s["cover"]]), json.dumps(s["beneficiary"]),
                    json.dumps({"city": s["city"], "country": "NG"}), json.dumps([]), deadline, published, published, now()
                ))

                # Budget items
                for item_name, amount in s["budget"]:
                    cur.execute("""
                        INSERT INTO campaign_budget_items (id, campaign_id, item, amount_kobo)
                        VALUES (%s, %s, %s, %s)
                    """, (uid("bgt_"), cid, item_name, amount))

                # Donations
                remaining = raised
                supporters = 0
                presets = [N(1000), N(2500), N(5000), N(10000), N(25000), N(50000)]
                while remaining > N(1000) and supporters < 20:
                    amt = random.choice(presets)
                    if amt > remaining:
                        amt = remaining
                    anon = random.random() < 0.2
                    ref = uid("don_")
                    cur.execute("""
                        INSERT INTO donations (
                            id, reference, campaign_id, donor_id, amount_kobo,
                            anonymous, message, status, provider, is_test, paid_at, created_at
                        ) VALUES (
                            %s, %s, %s, %s, %s,
                            %s, %s, %s, %s, %s, %s, %s
                        )
                    """, (
                        uid("dnt_"), ref, cid, None, amt,
                        anon, "Stay strong! Happy to support." if not anon else "",
                        "paid", "sandbox", True, published + timedelta(hours=supporters), published + timedelta(hours=supporters)
                    ))
                    remaining -= amt
                    supporters += 1

                # Update campaign raised and milestones
                pct = campaign_percent(raised, goal)
                milestones = [m for m in [25, 50, 75, 90, 100] if m <= pct]
                cur.execute("""
                    UPDATE campaigns 
                    SET raised_kobo = %s, supporters_count = %s, milestones_reached = %s
                    WHERE id = %s
                """, (raised, supporters, json.dumps(milestones), cid))

                # Update
                cur.execute("""
                    INSERT INTO campaign_updates (id, campaign_id, title, body, created_at)
                    VALUES (%s, %s, %s, %s, %s)
                """, (uid("upd_"), cid, "Thank you for the support!", f"We have reached {pct}% of our goal thanks to you.", published + timedelta(days=2)))
                cur.execute("UPDATE campaigns SET updates_count = 1, last_update_at = %s WHERE id = %s", (published + timedelta(days=2), cid))

            conn.commit()
            print("Successfully seeded all initial Supabase campaigns and donations!")

if __name__ == "__main__":
    seed()
