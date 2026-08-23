"""Idempotent seed: categories, admin, sample organizers, campaigns, donations, updates."""
import random
from datetime import timedelta
from core import db, uid, now, now_iso, hash_password, campaign_percent

MED = "https://images.unsplash.com/photo-1631815590058-860e4f83c1e8?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMjV8MHwxfHNlYXJjaHwxfHxtZWRpY2FsJTIwc3RhZmYlMjBoZWxwaW5nJTIwcGF0aWVudHxlbnwwfHx8fDE3ODc0ODAzMzJ8MA&ixlib=rb-4.1.0&q=85"
SCHOOL = "https://images.unsplash.com/photo-1584750153892-38414eb8e76a?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2Mzl8MHwxfHNlYXJjaHwxfHxjb21tdW5pdHklMjBzY2hvb2wlMjBidWlsZGluZyUyMHByb2plY3R8ZW58MHx8fHwxNzg3NDgwMzMyfDA&ixlib=rb-4.1.0&q=85"
COMMUNITY = "https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2Mzl8MHwxfHNlYXJjaHwyfHxjb21tdW5pdHklMjBoYW5kcyUyMHRvZ2V0aGVyfGVufDB8fHx8MTc4NzQ4MDMyMnww&ixlib=rb-4.1.0&q=85"
AVATAR = "https://images.unsplash.com/photo-1614023342667-6f060e9d1e04?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1ODF8MHwxfHNlYXJjaHwyfHxtb2Rlcm4lMjBhZnJpY2FuJTIwc3RhcnR1cCUyMGZvdW5kZXJ8ZW58MHx8fHwxNzg3NDgwMzMyfDA&ixlib=rb-4.1.0&q=85"

def pic(seed):
    return f"https://picsum.photos/seed/{seed}/1000/700"

CATEGORIES = [
    {"slug": "medical", "name": "Medical", "icon": "heart", "color": "#B83A3A", "order": 1},
    {"slug": "education", "name": "Education", "icon": "book-open", "color": "#4A6E82", "order": 2},
    {"slug": "emergency", "name": "Emergency", "icon": "alert-triangle", "color": "#D99026", "order": 3},
    {"slug": "community", "name": "Community", "icon": "users", "color": "#2D7A5D", "order": 4},
    {"slug": "memorial", "name": "Memorial", "icon": "feather", "color": "#7A3520", "order": 5},
    {"slug": "business", "name": "Business", "icon": "briefcase", "color": "#C05C3D", "order": 6},
    {"slug": "environment", "name": "Environment", "icon": "sun", "color": "#2D7A5D", "order": 7},
    {"slug": "animals", "name": "Animals", "icon": "github", "color": "#5C5954", "order": 8},
]

def N(naira):
    return naira * 100


ADMIN_EMAILS = {"admin@goodcause.ng", "faithfulgodwinc@gmail.com"}

async def seed():
    # Admin (always ensure exists / correct)
    for email in ADMIN_EMAILS:
        admin = await db.users.find_one({"email": email})
        if not admin:
            display_name = "Faithful Godwin" if email == "faithfulgodwinc@gmail.com" else "GoodCause Admin"
            await db.users.insert_one({
                "id": uid("usr_"), "email": email, "name": display_name,
                "password_hash": hash_password("Admin@12345"), "picture": None,
                "role": "admin", "bio": "Platform administrator", "verified_organizer": True,
                "auth_provider": "password", "created_at": now_iso(),
            })
        else:
            await db.users.update_one(
                {"email": email},
                {"$set": {"role": "admin", "verified_organizer": True}}
            )

    if await db.categories.count_documents({}) == 0:
        for c in CATEGORIES:
            await db.categories.insert_one({"id": uid("cat_"), **c})

    if await db.campaigns.count_documents({}) > 0:
        return  # already seeded

    cats = {c["slug"]: c async for c in db.categories.find({})}

    # organizers
    organizers = []
    org_specs = [
        ("chidi@goodcause.ng", "Chidi Okafor", "Community volunteer in Owerri."),
        ("amina@goodcause.ng", "Amina Bello", "Nurse and family advocate, Abuja."),
        ("tayo@goodcause.ng", "Tayo Adeyemi", "Small business owner, Lagos."),
    ]
    for email, name, bio in org_specs:
        oid = uid("usr_")
        await db.users.insert_one({
            "id": oid, "email": email, "name": name,
            "password_hash": hash_password("Passw0rd!"), "picture": AVATAR,
            "role": "donor", "bio": bio, "verified_organizer": True,
            "auth_provider": "password", "created_at": now_iso(),
        })
        organizers.append(oid)

    def checks(all_true=True):
        return {"identity": all_true, "beneficiary": all_true, "documents": all_true,
                "relationship": all_true, "updates_enabled": True}

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
        dict(title="Reopen Mama Nkechi's Bakery", cat="business", cover=pic("bakery"), featured=False, urgent=False,
             goal=N(2_500_000), summary="A fire destroyed her ovens. Help her rebuild and employ 6 people.",
             beneficiary={"name": "Nkechi Eze", "relationship": "self", "type": "self"},
             budget=[("Industrial oven", N(1_400_000)), ("Ingredients", N(600_000)), ("Repairs", N(500_000))],
             city="Aba", days=45, pct=45),
        dict(title="Laptops for FUTO Coders", cat="education", cover=pic("coders"), featured=False, urgent=False,
             goal=N(3_500_000), summary="Refurbished laptops for 20 self-taught student developers.",
             beneficiary={"name": "FUTO Code Club", "relationship": "community", "type": "organization"},
             budget=[("20 laptops", N(2_800_000)), ("Internet stipend", N(400_000)), ("Setup", N(300_000))],
             city="Owerri", days=30, pct=76),
        dict(title="Support the Okoro Family", cat="memorial", cover=pic("family"), featured=False, urgent=False,
             goal=N(2_000_000), summary="Help the Okoro children stay in school after losing their father.",
             beneficiary={"name": "Okoro children", "relationship": "family", "type": "individual"},
             budget=[("School fees", N(1_200_000)), ("Living support", N(800_000))],
             city="Uyo", days=50, pct=33),
        dict(title="Protect the Lekki Mangroves", cat="environment", cover=pic("mangrove"), featured=False, urgent=False,
             goal=N(4_500_000), summary="Community-led replanting to restore a vital coastal ecosystem.",
             beneficiary={"name": "Lekki Green Initiative", "relationship": "community", "type": "organization"},
             budget=[("Seedlings", N(1_500_000)), ("Community wages", N(2_000_000)), ("Monitoring", N(1_000_000))],
             city="Lagos", days=70, pct=18),
    ]

    for i, s in enumerate(specs):
        cat = cats[s["cat"]]
        org = organizers[i % len(organizers)]
        goal = s["goal"]
        raised = int(goal * s["pct"] / 100)
        cid = uid("cmp_")
        published = now() - timedelta(days=random.randint(6, 30))
        story = (
            f"{s['summary']}\n\n"
            f"Every contribution, big or small, moves this cause forward. We are raising these funds "
            f"transparently and will share regular updates so you can see exactly how your generosity helps.\n\n"
            f"Thank you for being part of this. Together, trust makes generosity go further."
        )
        doc = {
            "id": cid, "organizer_id": org, "title": s["title"], "summary": s["summary"],
            "story": story, "category_id": cat["id"], "category_name": cat["name"],
            "goal_kobo": goal, "raised_kobo": 0, "currency": "NGN",
            "cover_image": s["cover"], "gallery": [s["cover"]],
            "budget": [{"item": it, "amount_kobo": am} for it, am in s["budget"]],
            "beneficiary": s["beneficiary"],
            "deadline": (now() + timedelta(days=s["days"])).isoformat(),
            "location": {"city": s["city"], "country": "NG"},
            "status": "LIVE",
            "verification": {"status": "VERIFIED", "checks": checks(True), "verified_at": now_iso()},
            "featured": s["featured"], "urgent": s["urgent"],
            "supporters_count": 0, "updates_count": 0, "milestones_reached": [],
            "created_at": published.isoformat(), "updated_at": now_iso(),
            "published_at": published.isoformat(), "last_update_at": None,
        }
        await db.campaigns.insert_one(doc)

        # generate realistic paid donations summing ~ raised
        remaining = raised
        supporters = 0
        names = ["Ada", "Emeka", "Fatima", "Segun", "Ngozi", "Ibrahim", "Chioma", "Bola",
                 "Yusuf", "Grace", "Kelechi", "Zainab", "Uche", "Femi", "Blessing"]
        presets = [N(1000), N(2500), N(5000), N(10000), N(25000), N(50000)]
        while remaining > N(1000) and supporters < 40:
            amt = random.choice(presets)
            if amt > remaining:
                amt = remaining
            anon = random.random() < 0.25
            ref = uid("don_")
            await db.donations.insert_one({
                "id": uid("dnt_"), "reference": ref, "campaign_id": cid,
                "donor_id": None, "donor_name": None if anon else random.choice(names),
                "anonymous": anon, "message": random.choice(
                    ["", "", "Sending love and strength.", "You've got this!", "Praying for you.",
                     "Happy to help.", "Stay strong 🙏"]),
                "amount_kobo": amt, "currency": "NGN", "status": "paid", "provider": "sandbox",
                "test": True, "email": "seed@goodcause.ng",
                "created_at": (published + timedelta(hours=supporters)).isoformat(),
                "paid_at": (published + timedelta(hours=supporters)).isoformat(),
            })
            remaining -= amt
            supporters += 1

        # milestones based on final pct
        pct = campaign_percent(raised, goal)
        reached = [m for m in [25, 50, 75, 90, 100] if m <= pct]
        await db.campaigns.update_one({"id": cid}, {"$set": {
            "raised_kobo": raised, "supporters_count": supporters,
            "milestones_reached": reached}})

        # a couple of updates for a few campaigns
        if i < 4:
            await db.campaign_updates.insert_one({
                "id": uid("upd_"), "campaign_id": cid, "author_id": org,
                "title": "Thank you for the strong start",
                "body": f"We've reached {pct}% of our goal. Your support means everything — updates will keep coming.",
                "image": None, "milestone": reached[-1] if reached else None,
                "created_at": (published + timedelta(days=3)).isoformat(),
            })
            await db.campaigns.update_one({"id": cid}, {
                "$inc": {"updates_count": 1},
                "$set": {"last_update_at": (published + timedelta(days=3)).isoformat()}})

    # one campaign awaiting review (for admin demo)
    cat = cats["medical"]
    rid = uid("cmp_")
    await db.campaigns.insert_one({
        "id": rid, "organizer_id": organizers[1], "title": "Chemotherapy for Coach Tunde",
        "summary": "Beloved grassroots football coach needs 6 cycles of chemotherapy.",
        "story": "Coach Tunde has mentored hundreds of young players. He now needs our help.\n\nWe are seeking support for his treatment and will share verified receipts.",
        "category_id": cat["id"], "category_name": cat["name"],
        "goal_kobo": N(5_500_000), "raised_kobo": 0, "currency": "NGN",
        "cover_image": pic("coach"), "gallery": [pic("coach")],
        "budget": [{"item": "Chemotherapy (6 cycles)", "amount_kobo": N(4_000_000)},
                   {"item": "Scans & tests", "amount_kobo": N(900_000)},
                   {"item": "Medication", "amount_kobo": N(600_000)}],
        "beneficiary": {"name": "Tunde Bakare", "relationship": "friend", "type": "individual"},
        "deadline": (now() + timedelta(days=35)).isoformat(),
        "location": {"city": "Ilorin", "country": "NG"},
        "status": "SUBMITTED",
        "verification": {"status": "IN_REVIEW", "checks": checks(False)},
        "featured": False, "urgent": False,
        "supporters_count": 0, "updates_count": 0, "milestones_reached": [],
        "created_at": now_iso(), "updated_at": now_iso(),
        "published_at": None, "last_update_at": None,
    })
