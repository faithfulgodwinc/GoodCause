"""GoodCause backend integration test suite (pytest).

Tests all critical MVP flows against public preview URL.
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL")
if not BASE_URL:
    # fallback to frontend/.env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip()
                break
API = BASE_URL.rstrip("/") + "/api"

ADMIN_EMAIL = "admin@goodcause.ng"
ADMIN_PASSWORD = "Admin@12345"
ORG_EMAIL = "amina@goodcause.ng"
ORG_PASSWORD = "Passw0rd!"


# --------- fixtures ---------
@pytest.fixture(scope="session")
def s():
    return requests.Session()


@pytest.fixture(scope="session")
def admin_token(s):
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def organizer_token(s):
    r = s.post(f"{API}/auth/login", json={"email": ORG_EMAIL, "password": ORG_PASSWORD})
    assert r.status_code == 200, f"organizer login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def donor_token(s):
    # Register fresh donor for isolation
    email = f"TEST_donor_{uuid.uuid4().hex[:8]}@test.com"
    r = s.post(f"{API}/auth/register", json={"email": email, "password": "secret1", "name": "Test Donor"})
    assert r.status_code == 200, f"donor register failed: {r.status_code} {r.text}"
    return r.json()["token"]


def H(tok):
    return {"Authorization": f"Bearer {tok}"}


# --------- META ---------
class TestMeta:
    def test_root(self, s):
        r = s.get(f"{API}/")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"

    def test_config_sandbox(self, s):
        r = s.get(f"{API}/config")
        assert r.status_code == 200
        j = r.json()
        assert j["payment_mode"] == "sandbox"
        assert j["pro"]["entitlement"] == "pro"
        assert isinstance(j["pro"]["features"], list) and len(j["pro"]["features"]) >= 4


# --------- AUTH ---------
class TestAuth:
    def test_register_and_login(self, s):
        email = f"test_u_{uuid.uuid4().hex[:8]}@t.com"
        r = s.post(f"{API}/auth/register", json={"email": email, "password": "secret1", "name": "T"})
        assert r.status_code == 200
        data = r.json()
        assert "token" in data and data["user"]["email"] == email.lower()
        r2 = s.post(f"{API}/auth/login", json={"email": email, "password": "secret1"})
        assert r2.status_code == 200

    def test_login_wrong_password(self, s):
        r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"})
        assert r.status_code == 401
        assert "Incorrect" in r.json().get("detail", "")

    def test_me(self, s, donor_token):
        r = s.get(f"{API}/auth/me", headers=H(donor_token))
        assert r.status_code == 200
        assert r.json()["role"] == "donor"

    def test_me_unauthorized(self, s):
        r = s.get(f"{API}/auth/me")
        assert r.status_code in (401, 403)

    def test_logout(self, s, donor_token):
        r = s.post(f"{API}/auth/logout", headers=H(donor_token))
        assert r.status_code == 200


# --------- HOME / EXPLORE ---------
class TestHomeExplore:
    def test_home_sections(self, s):
        r = s.get(f"{API}/home")
        assert r.status_code == 200
        j = r.json()
        for key in ["featured", "urgent", "almost_funded", "recently_updated", "recommended", "categories"]:
            assert key in j, f"missing {key}"
        assert isinstance(j["categories"], list) and len(j["categories"]) > 0

    def test_categories(self, s):
        r = s.get(f"{API}/categories")
        assert r.status_code == 200
        assert isinstance(r.json(), list) and len(r.json()) > 0

    def test_campaigns_list(self, s):
        r = s.get(f"{API}/campaigns", params={"limit": 10})
        assert r.status_code == 200
        assert "items" in r.json()

    def test_campaigns_search(self, s):
        r = s.get(f"{API}/campaigns", params={"search": "cancer", "limit": 5})
        assert r.status_code == 200

    def test_campaigns_by_category(self, s):
        cats = s.get(f"{API}/categories").json()
        cat_id = cats[0]["id"]
        r = s.get(f"{API}/campaigns", params={"category": cat_id, "limit": 5})
        assert r.status_code == 200


# --------- CAMPAIGN DETAIL ---------
class TestCampaignDetail:
    def test_campaign_detail(self, s):
        items = s.get(f"{API}/campaigns", params={"limit": 1}).json()["items"]
        assert items, "No LIVE campaigns seeded"
        cid = items[0]["id"]
        r = s.get(f"{API}/campaigns/{cid}")
        assert r.status_code == 200
        d = r.json()
        assert "verification" in d and "checks" in d["verification"]
        assert "budget" in d
        assert "beneficiary" in d

    def test_campaign_404(self, s):
        r = s.get(f"{API}/campaigns/does-not-exist")
        assert r.status_code == 404


# --------- DONATION SANDBOX FLOW (P0) ---------
class TestDonationFlow:
    def test_full_donation_flow(self, s, donor_token):
        items = s.get(f"{API}/campaigns", params={"limit": 5}).json()["items"]
        assert items
        cid = items[0]["id"]
        before = s.get(f"{API}/campaigns/{cid}").json()
        prev_raised = before["raised_kobo"]
        prev_supporters = before.get("supporters_count", 0)

        # Initialize donation
        r = s.post(f"{API}/campaigns/{cid}/donate",
                   json={"amount_kobo": 500000, "anonymous": False, "message": "TEST_donation"},
                   headers=H(donor_token))
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["sandbox"] is True
        assert d["provider"] == "sandbox"
        assert d["reference"]

        # Complete via sandbox
        r2 = s.post(f"{API}/donations/sandbox-complete",
                    json={"reference": d["reference"]}, headers=H(donor_token))
        assert r2.status_code == 200, r2.text
        j = r2.json()
        assert j["status"] == "paid"
        assert j["test"] is True
        assert "prev_percent" in j and "new_percent" in j
        assert j["new_percent"] >= j["prev_percent"]

        # Verify persistence
        after = s.get(f"{API}/campaigns/{cid}").json()
        assert after["raised_kobo"] == prev_raised + 500000
        assert after["supporters_count"] >= prev_supporters + 1

        # Idempotency: same reference again should not double-count
        r3 = s.post(f"{API}/donations/sandbox-complete",
                    json={"reference": d["reference"]}, headers=H(donor_token))
        # Either 200 already-paid or a controlled response
        assert r3.status_code in (200, 400)
        again = s.get(f"{API}/campaigns/{cid}").json()
        assert again["raised_kobo"] == after["raised_kobo"], "Donation double-counted!"

    def test_my_donations_and_impact(self, s, donor_token):
        r = s.get(f"{API}/donations/mine", headers=H(donor_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list) and len(r.json()) >= 1
        r2 = s.get(f"{API}/impact", headers=H(donor_token))
        assert r2.status_code == 200
        j = r2.json()
        assert j["total_contributed_kobo"] >= 500000
        assert j["causes_supported"] >= 1


# --------- FOLLOW/SAVE/REPORT ---------
class TestSocial:
    def test_follow_save_report(self, s, donor_token):
        items = s.get(f"{API}/campaigns", params={"limit": 1}).json()["items"]
        cid = items[0]["id"]
        r = s.post(f"{API}/campaigns/{cid}/follow", headers=H(donor_token))
        assert r.status_code == 200 and r.json()["following"] is True
        r = s.post(f"{API}/campaigns/{cid}/save", headers=H(donor_token))
        assert r.status_code == 200 and r.json()["saved"] is True
        # verify saved list
        r = s.get(f"{API}/saved", headers=H(donor_token))
        assert r.status_code == 200 and any(c["id"] == cid for c in r.json())
        # unfollow
        r = s.delete(f"{API}/campaigns/{cid}/follow", headers=H(donor_token))
        assert r.status_code == 200 and r.json()["following"] is False
        r = s.delete(f"{API}/campaigns/{cid}/save", headers=H(donor_token))
        assert r.status_code == 200
        # report
        r = s.post(f"{API}/campaigns/{cid}/report",
                   json={"reason": "spam", "details": "TEST"}, headers=H(donor_token))
        assert r.status_code == 200 and r.json()["ok"] is True


# --------- CAMPAIGN CREATE + SUBMIT ---------
class TestCampaignBuilder:
    def test_create_and_submit(self, s, donor_token):
        cats = s.get(f"{API}/categories").json()
        payload = {
            "title": "TEST_ Campaign Build",
            "summary": "TEST summary here",
            "story": "TEST story with details.",
            "category_id": cats[0]["id"],
            "goal_kobo": 100000000,
            "cover_image": "https://placehold.co/600",
            "budget": [{"item": "Medicines", "amount_kobo": 50000000}],
            "beneficiary": {"name": "TEST Beneficiary", "relationship": "self", "type": "individual"},
        }
        r = s.post(f"{API}/campaigns", json=payload, headers=H(donor_token))
        assert r.status_code == 200, r.text
        cid = r.json()["id"]
        assert r.json()["status"] == "DRAFT"
        # submit
        r2 = s.post(f"{API}/campaigns/{cid}/submit", headers=H(donor_token))
        assert r2.status_code == 200
        j = r2.json()
        assert j["status"] == "SUBMITTED"
        assert j["verification"]["status"] == "IN_REVIEW"


# --------- ADMIN ---------
class TestAdmin:
    def test_admin_stats(self, s, admin_token):
        r = s.get(f"{API}/admin/stats", headers=H(admin_token))
        assert r.status_code == 200
        j = r.json()
        for k in ["total_campaigns", "live_campaigns", "pending_review", "total_users", "total_raised_kobo"]:
            assert k in j

    def test_admin_requires_admin_role(self, s, donor_token):
        r = s.get(f"{API}/admin/stats", headers=H(donor_token))
        assert r.status_code in (401, 403)

    def test_admin_moderation_flow(self, s, admin_token, organizer_token):
        # find a SUBMITTED campaign or create one
        r = s.get(f"{API}/admin/campaigns", params={"status": "SUBMITTED"}, headers=H(admin_token))
        assert r.status_code == 200
        subs = r.json()
        if not subs:
            # create one as organizer
            cats = s.get(f"{API}/categories").json()
            payload = {"title": "TEST_ Admin flow", "summary": "s", "story": "s",
                       "category_id": cats[0]["id"], "goal_kobo": 5000000,
                       "beneficiary": {"name": "T", "relationship": "self"}}
            r = s.post(f"{API}/campaigns", json=payload, headers=H(organizer_token))
            cid = r.json()["id"]
            s.post(f"{API}/campaigns/{cid}/submit", headers=H(organizer_token))
        else:
            cid = subs[0]["id"]

        # verify
        r = s.post(f"{API}/admin/campaigns/{cid}/verify", headers=H(admin_token),
                   json={"identity": True, "beneficiary": True, "documents": True,
                         "relationship": True, "updates_enabled": True})
        assert r.status_code == 200
        assert r.json()["status"] == "VERIFIED"

        # publish
        r = s.post(f"{API}/admin/campaigns/{cid}/publish", headers=H(admin_token))
        assert r.status_code == 200
        assert r.json()["status"] == "LIVE"

    def test_admin_reports_and_transactions(self, s, admin_token):
        r = s.get(f"{API}/admin/reports", headers=H(admin_token))
        assert r.status_code == 200
        r = s.get(f"{API}/admin/transactions", headers=H(admin_token))
        assert r.status_code == 200


# --------- CIRCLES ---------
class TestCircles:
    def test_circles_create_join_get(self, s, donor_token):
        name = f"TEST_ Circle {uuid.uuid4().hex[:6]}"
        r = s.post(f"{API}/circles", json={"name": name, "description": "TEST"}, headers=H(donor_token))
        assert r.status_code == 200, r.text
        c = r.json()
        assert c["invite_code"]
        # register another user and join
        email = f"TEST_j_{uuid.uuid4().hex[:8]}@t.com"
        r2 = s.post(f"{API}/auth/register", json={"email": email, "password": "secret1", "name": "J"})
        joiner = r2.json()["token"]
        r3 = s.post(f"{API}/circles/join", json={"invite_code": c["invite_code"]}, headers=H(joiner))
        assert r3.status_code == 200
        assert r3.json()["is_member"] is True

        # bad invite
        r4 = s.post(f"{API}/circles/join", json={"invite_code": "NOPE9999"}, headers=H(joiner))
        assert r4.status_code == 404

        # get
        r5 = s.get(f"{API}/circles/{c['id']}", headers=H(donor_token))
        assert r5.status_code == 200

    def test_list_circles(self, s, donor_token):
        r = s.get(f"{API}/circles", headers=H(donor_token))
        assert r.status_code == 200
        j = r.json()
        assert "mine" in j and "discover" in j


# --------- NOTIFICATIONS ---------
class TestNotifications:
    def test_list_and_read_all(self, s, donor_token):
        r = s.get(f"{API}/notifications", headers=H(donor_token))
        assert r.status_code == 200
        assert "items" in r.json() and "unread" in r.json()
        r2 = s.post(f"{API}/notifications/read-all", headers=H(donor_token))
        assert r2.status_code == 200

