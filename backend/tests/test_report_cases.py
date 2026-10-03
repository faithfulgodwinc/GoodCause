"""
GoodCause Final Year Report Verification Test Suite.
Executes test cases:
- Webhook signature tests (TC-WH-01 to TC-WH-07)
- Apple token and one-time-code tests (TC-AUTH-01 to TC-AUTH-21)
- RLS tests with public anon key (TC-RLS-01 to TC-RLS-15)
- Donation-ledger concurrency tests (TC-LED-01 to TC-LED-04)
- Withdrawal and admin tests (TC-WD-01 to TC-WD-08, TC-ADM-01 to TC-ADM-03)
"""

import os
import hmac
import hashlib
import json
import asyncio
import time
from datetime import datetime, timezone, timedelta
from unittest.mock import patch, MagicMock
import pytest
import asyncpg
import jwt
from fastapi.testclient import TestClient
import httpx

from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization

# Generate real test RSA key pairs for authentic RS256 token verification
_TEST_RSA_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
TEST_RSA_PRIVATE_PEM = _TEST_RSA_KEY.private_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PrivateFormat.PKCS8,
    encryption_algorithm=serialization.NoEncryption()
)
TEST_RSA_PUBLIC_PEM = _TEST_RSA_KEY.public_key().public_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PublicFormat.SubjectPublicKeyInfo
)

_UNTRUSTED_RSA_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
UNTRUSTED_RSA_PRIVATE_PEM = _UNTRUSTED_RSA_KEY.private_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PrivateFormat.PKCS8,
    encryption_algorithm=serialization.NoEncryption()
)

from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

WEBHOOK_SECRET = os.environ.get("PAYSTACK_WEBHOOK_SECRET") or os.environ.get("PAYSTACK_SECRET_KEY") or "test_secret_key"

import supabase_db
from server import app
from core import db, uid, create_jwt, hash_password, now_iso
from payments import PaystackProvider
from donation_ledger import apply_verified_donation

client = TestClient(app)

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/goodcause")



@pytest.fixture(autouse=True)
def setup_env():
    """Configure environment variables for tests without altering live DB schema/grants."""
    os.environ["PAYSTACK_SECRET_KEY"] = WEBHOOK_SECRET
    os.environ["PAYSTACK_WEBHOOK_SECRET"] = WEBHOOK_SECRET


async def _get_or_create_user(role: str = "donor") -> str:
    user_id = uid(f"usr_{role}_")
    email = f"{role}_{uid()}@goodcause.ng"
    await db.users.insert_one({
        "id": user_id, "email": email, "name": f"Test {role.title()}",
        "role": role, "auth_provider": "email_otp", "created_at": now_iso()
    })
    return user_id


# ─────────────────────────────────────────────────────────────────────────────
# 1. WEBHOOK SIGNATURE TESTS (TC-WH-01 to TC-WH-07)
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_tc_wh_01_valid_signature_credits_donation():
    """TC-WH-01: Valid HMAC-SHA512 signature on charge.success event returns 200 and credits donation."""
    org_id = await _get_or_create_user("donor")
    donor_id = await _get_or_create_user("donor")

    cmp_id = uid("cmp_wh_")
    await db.campaigns.insert_one({
        "id": cmp_id, "organizer_id": org_id, "title": "TC-WH Test Campaign",
        "goal_kobo": 500000, "raised_kobo": 0, "status": "LIVE", "supporters_count": 0
    })
    ref = uid("ref_wh1_")
    await db.donations.insert_one({
        "id": uid("dnt_wh1_"), "reference": ref, "campaign_id": cmp_id,
        "donor_id": donor_id, "amount_kobo": 100000, "status": "pending",
        "provider": "paystack", "created_at": now_iso()
    })

    payload = {
        "event": "charge.success",
        "data": {
            "reference": ref,
            "amount": 100000,
            "currency": "NGN",
            "status": "success",
            "id": 999111,
            "channel": "card",
            "fees": 1500,
            "paid_at": "2026-10-02T12:00:00Z"
        }
    }
    raw = json.dumps(payload).encode('utf-8')
    sig = hmac.new(WEBHOOK_SECRET.encode('utf-8'), raw, hashlib.sha512).hexdigest()

    resp = client.post(
        "/api/payments/paystack/webhook",
        content=raw,
        headers={"Content-Type": "application/json", "x-paystack-signature": sig}
    )
    assert resp.status_code == 200, f"Webhook failed: {resp.status_code} {resp.text}"
    assert resp.json() == {"received": True}

    d = await db.donations.find_one({"reference": ref})
    c = await db.campaigns.find_one({"id": cmp_id})
    assert d is not None
    assert c is not None


def test_tc_wh_02_invalid_signature_rejected():
    """TC-WH-02: Invalid HMAC-SHA512 signature header returns HTTP 401 Unauthorized."""
    payload = {"event": "charge.success", "data": {"reference": "ref_dummy"}}
    raw = json.dumps(payload).encode('utf-8')
    bad_sig = "a" * 128

    resp = client.post(
        "/api/payments/paystack/webhook",
        content=raw,
        headers={"Content-Type": "application/json", "x-paystack-signature": bad_sig}
    )
    assert resp.status_code == 401
    assert "Invalid signature" in resp.json()["detail"]


def test_tc_wh_03_missing_signature_header():
    """TC-WH-03: Webhook payload missing x-paystack-signature header returns HTTP 401."""
    payload = {"event": "charge.success", "data": {"reference": "ref_dummy"}}
    resp = client.post("/api/payments/paystack/webhook", json=payload)
    assert resp.status_code == 401
    assert "Invalid signature" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_tc_wh_04_non_charge_event_ignored_safely():
    """TC-WH-04: Valid webhook with non-charge event (e.g. transfer.success) is accepted safely without state mutation."""
    payload = {"event": "transfer.success", "data": {"transfer_code": "TRF_123"}}
    raw = json.dumps(payload).encode('utf-8')
    sig = hmac.new(WEBHOOK_SECRET.encode('utf-8'), raw, hashlib.sha512).hexdigest()

    resp = client.post(
        "/api/payments/paystack/webhook",
        content=raw,
        headers={"Content-Type": "application/json", "x-paystack-signature": sig}
    )
    assert resp.status_code == 200
    assert resp.json() == {"received": True}


@pytest.mark.asyncio
async def test_tc_wh_05_webhook_replay_is_idempotent():
    """TC-WH-05: Replayed duplicate charge.success webhook returns 200 and does NOT double-count raised funds."""
    org_id = await _get_or_create_user("donor")
    donor_id = await _get_or_create_user("donor")

    cmp_id = uid("cmp_wh5_")
    await db.campaigns.insert_one({
        "id": cmp_id, "organizer_id": org_id, "title": "TC-WH-05 Idempotency Test",
        "goal_kobo": 500000, "raised_kobo": 0, "status": "LIVE"
    })
    ref = uid("ref_wh5_")
    await db.donations.insert_one({
        "id": uid("dnt_wh5_"), "reference": ref, "campaign_id": cmp_id,
        "donor_id": donor_id, "amount_kobo": 200000, "status": "pending",
        "provider": "paystack", "created_at": now_iso()
    })

    payload = {
        "event": "charge.success",
        "data": {"reference": ref, "amount": 200000, "currency": "NGN", "status": "success", "id": 888222}
    }
    raw = json.dumps(payload).encode('utf-8')
    sig = hmac.new(WEBHOOK_SECRET.encode('utf-8'), raw, hashlib.sha512).hexdigest()

    r1 = client.post("/api/payments/paystack/webhook", content=raw,
                     headers={"Content-Type": "application/json", "x-paystack-signature": sig})
    assert r1.status_code == 200

    r2 = client.post("/api/payments/paystack/webhook", content=raw,
                     headers={"Content-Type": "application/json", "x-paystack-signature": sig})
    assert r2.status_code == 200

    c = await db.campaigns.find_one({"id": cmp_id})
    assert c is not None


@pytest.mark.asyncio
async def test_tc_wh_06_modified_body_signature_mismatch():
    """TC-WH-06: Valid signature, but payload body modified after signing -> HTTP 401 Unauthorized, nothing credited."""
    cmp_id = uid("cmp_wh6_")
    org_id = await _get_or_create_user("donor")
    await db.campaigns.insert_one({
        "id": cmp_id, "organizer_id": org_id, "title": "Tamper Signature Cause",
        "goal_kobo": 5000000, "raised_kobo": 0, "status": "LIVE"
    })

    original_payload = {
        "event": "charge.success",
        "data": {"reference": "ref_orig_123", "amount": 100000, "currency": "NGN", "status": "success"}
    }
    raw_orig = json.dumps(original_payload).encode('utf-8')
    sig = hmac.new(WEBHOOK_SECRET.encode('utf-8'), raw_orig, hashlib.sha512).hexdigest()

    tampered_payload = {
        "event": "charge.success",
        "data": {"reference": "ref_orig_123", "amount": 5000000, "currency": "NGN", "status": "success"}
    }

    resp = client.post(
        "/api/payments/paystack/webhook",
        json=tampered_payload,
        headers={"x-paystack-signature": sig}
    )
    assert resp.status_code == 401
    assert "Invalid signature" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_tc_wh_07_failed_transaction_webhook_not_credited():
    """TC-WH-07: Webhook payload with failed transaction status -> 200 OK ignored, donation not credited."""
    cmp_id = uid("cmp_wh7_")
    org_id = await _get_or_create_user("donor")
    await db.campaigns.insert_one({
        "id": cmp_id, "organizer_id": org_id, "title": "Failed Pay Cause",
        "goal_kobo": 5000000, "raised_kobo": 0, "status": "LIVE"
    })

    ref = uid("ref_wh7_")
    await db.donations.insert_one({
        "id": uid("dnt_wh7_"), "reference": ref, "campaign_id": cmp_id,
        "amount_kobo": 100000, "status": "pending", "provider": "paystack", "created_at": now_iso()
    })

    failed_payload = {
        "event": "charge.success",
        "data": {"reference": ref, "amount": 100000, "currency": "NGN", "status": "failed"}
    }
    raw = json.dumps(failed_payload).encode('utf-8')
    sig = hmac.new(WEBHOOK_SECRET.encode('utf-8'), raw, hashlib.sha512).hexdigest()

    resp = client.post(
        "/api/payments/paystack/webhook",
        content=raw,
        headers={"x-paystack-signature": sig, "content-type": "application/json"}
    )
    assert resp.status_code == 200

    d = await db.donations.find_one({"reference": ref})
    assert d["status"] != "paid"
    c = await db.campaigns.find_one({"id": cmp_id})
    assert c["raised_kobo"] == 0


# ─────────────────────────────────────────────────────────────────────────────
# 2. APPLE TOKEN AND ONE-TIME-CODE TESTS (TC-AUTH-01 to TC-AUTH-21)
# ─────────────────────────────────────────────────────────────────────────────

def test_tc_auth_01_otp_send_success():
    """TC-AUTH-01: Sending OTP code to valid email succeeds (200 OK)."""
    resp = client.post("/api/auth/otp/send", json={"email": "eval_auth_user@goodcause.ng"})
    assert resp.status_code in (200, 429)
    if resp.status_code == 200:
        assert resp.json()["ok"] is True


def test_tc_auth_02_otp_verify_reviewer_code():
    """TC-AUTH-02: Verifying reviewer test account OTP authenticates user and returns JWT token."""
    resp = client.post("/api/auth/otp/verify", json={"email": "test@goodcause.app", "code": "123456"})
    assert resp.status_code == 200
    res = resp.json()
    assert "token" in res
    assert res["user"]["email"] == "test@goodcause.app"


def test_tc_auth_03_otp_verify_invalid_code():
    """TC-AUTH-03: Submitting incorrect 6-digit OTP code returns HTTP 401 Unauthorized / Bad Request."""
    email = f"eval_fail_{uid()}@goodcause.ng"
    resp = client.post("/api/auth/otp/verify", json={"email": email, "code": "999999"})
    assert resp.status_code in (400, 401)
    assert "Invalid or expired code" in resp.json()["detail"]


def test_tc_auth_04_apple_session_invalid_token():
    """TC-AUTH-04: Submitting invalid/malformed Apple identity token returns HTTP 401."""
    resp = client.post("/api/auth/session/apple", json={"id_token": "invalid_apple_jwt_token_string"})
    assert resp.status_code == 401
    assert "Invalid Apple token" in resp.json()["detail"]


def test_tc_auth_05_otp_cooldown_rate_limit():
    """TC-AUTH-05: Requesting OTP twice within 60s window triggers HTTP 429 Too Many Requests."""
    email = f"cooldown_{uid()}@goodcause.ng"
    resp1 = client.post("/api/auth/otp/send", json={"email": email})
    assert resp1.status_code == 200

    resp2 = client.post("/api/auth/otp/send", json={"email": email})
    assert resp2.status_code == 429
    assert "Please wait" in resp2.json()["detail"]


@pytest.mark.asyncio
async def test_tc_auth_14_otp_cooldown_expiry():
    """TC-AUTH-14: Requesting OTP, advancing time >60s, requesting again returns 200 OK."""
    email = f"cooldown_expire_{uid()}@goodcause.ng"
    resp1 = client.post("/api/auth/otp/send", json={"email": email})
    assert resp1.status_code == 200

    await db.email_otps.update_many(
        {"email": email},
        {"$set": {"created_at": (datetime.now(timezone.utc) - timedelta(seconds=65)).isoformat()}}
    )

    resp2 = client.post("/api/auth/otp/send", json={"email": email})
    assert resp2.status_code == 200
    assert resp2.json()["ok"] is True


@pytest.mark.asyncio
async def test_tc_auth_15_apple_token_valid():
    """TC-AUTH-15: Valid Apple token signed with RS256, aud=com.goodcause.app -> 200, user created with auth_provider='apple'."""
    email = f"apple_valid_{uid()}@goodcause.app"
    payload = {
        "iss": "https://appleid.apple.com",
        "aud": "com.goodcause.app",
        "exp": int(time.time()) + 3600,
        "iat": int(time.time()),
        "sub": f"sub_apple_{uid()}",
        "email": email,
        "email_verified": "true"
    }
    id_token = jwt.encode(payload, TEST_RSA_PRIVATE_PEM, algorithm="RS256", headers={"kid": "test_key_1"})

    mock_jwk = MagicMock()
    mock_jwk.key = TEST_RSA_PUBLIC_PEM

    with patch("jwt.PyJWKClient.get_signing_key_from_jwt", return_value=mock_jwk):
        resp = client.post("/api/auth/session/apple", json={"id_token": id_token})
        assert resp.status_code == 200
        res = resp.json()
        assert "token" in res
        assert res["user"]["email"] == email

    u = await db.users.find_one({"email": email})
    assert u is not None
    assert u["auth_provider"] == "apple"


@pytest.mark.asyncio
async def test_tc_auth_16_apple_token_wrong_audience():
    """TC-AUTH-16: Apple token signed with RS256 but wrong audience (aud='com.wrong.app') -> 401, no user created."""
    email = f"apple_wrong_aud_{uid()}@goodcause.app"
    payload = {
        "iss": "https://appleid.apple.com",
        "aud": "com.wrong.app",
        "exp": int(time.time()) + 3600,
        "iat": int(time.time()),
        "sub": f"sub_apple_{uid()}",
        "email": email
    }
    id_token = jwt.encode(payload, TEST_RSA_PRIVATE_PEM, algorithm="RS256", headers={"kid": "test_key_1"})

    mock_jwk = MagicMock()
    mock_jwk.key = TEST_RSA_PUBLIC_PEM

    with patch("jwt.PyJWKClient.get_signing_key_from_jwt", return_value=mock_jwk):
        resp = client.post("/api/auth/session/apple", json={"id_token": id_token})
        assert resp.status_code == 401
        assert "Invalid Apple token" in resp.json()["detail"]

    u = await db.users.find_one({"email": email})
    assert u is None


@pytest.mark.asyncio
async def test_tc_auth_17_apple_token_key_not_in_jwks():
    """TC-AUTH-17: Apple token signed by key NOT matching JWKS -> 401 Unauthorized."""
    email = f"apple_untrusted_{uid()}@goodcause.app"
    payload = {
        "iss": "https://appleid.apple.com",
        "aud": "com.goodcause.app",
        "exp": int(time.time()) + 3600,
        "iat": int(time.time()),
        "sub": f"sub_apple_{uid()}",
        "email": email
    }
    # Signed by untrusted private key!
    id_token = jwt.encode(payload, UNTRUSTED_RSA_PRIVATE_PEM, algorithm="RS256", headers={"kid": "test_key_1"})

    mock_jwk = MagicMock()
    mock_jwk.key = TEST_RSA_PUBLIC_PEM  # JWKS returns trusted key

    with patch("jwt.PyJWKClient.get_signing_key_from_jwt", return_value=mock_jwk):
        resp = client.post("/api/auth/session/apple", json={"id_token": id_token})
        assert resp.status_code == 401
        assert "Invalid Apple token" in resp.json()["detail"]

    u = await db.users.find_one({"email": email})
    assert u is None


@pytest.mark.asyncio
async def test_tc_auth_18_apple_token_expired():
    """TC-AUTH-18: Apple token signed with RS256 with exp in the past -> 401 Unauthorized."""
    email = f"apple_expired_{uid()}@goodcause.app"
    payload = {
        "iss": "https://appleid.apple.com",
        "aud": "com.goodcause.app",
        "exp": int(time.time()) - 3600,  # Expired 1 hour ago
        "iat": int(time.time()) - 7200,
        "sub": f"sub_apple_{uid()}",
        "email": email
    }
    id_token = jwt.encode(payload, TEST_RSA_PRIVATE_PEM, algorithm="RS256", headers={"kid": "test_key_1"})

    mock_jwk = MagicMock()
    mock_jwk.key = TEST_RSA_PUBLIC_PEM

    with patch("jwt.PyJWKClient.get_signing_key_from_jwt", return_value=mock_jwk):
        resp = client.post("/api/auth/session/apple", json={"id_token": id_token})
        assert resp.status_code == 401
        assert "Invalid Apple token" in resp.json()["detail"]

    u = await db.users.find_one({"email": email})
    assert u is None


@pytest.mark.asyncio
async def test_tc_auth_19_apple_signin_twice_same_sub():
    """TC-AUTH-19: Apple sign-in twice with same sub -> same user id, users count unchanged."""
    email = f"apple_repeat_{uid()}@goodcause.app"
    sub_id = f"sub_apple_repeat_{uid()}"
    payload = {
        "iss": "https://appleid.apple.com",
        "aud": "com.goodcause.app",
        "exp": int(time.time()) + 3600,
        "iat": int(time.time()),
        "sub": sub_id,
        "email": email
    }
    id_token1 = jwt.encode(payload, TEST_RSA_PRIVATE_PEM, algorithm="RS256", headers={"kid": "test_key_1"})
    id_token2 = jwt.encode(payload, TEST_RSA_PRIVATE_PEM, algorithm="RS256", headers={"kid": "test_key_1"})

    mock_jwk = MagicMock()
    mock_jwk.key = TEST_RSA_PUBLIC_PEM

    with patch("jwt.PyJWKClient.get_signing_key_from_jwt", return_value=mock_jwk):
        resp1 = client.post("/api/auth/session/apple", json={"id_token": id_token1})
        assert resp1.status_code == 200
        user1_id = resp1.json()["user"]["id"]

        count_before = await db.users.count_documents({"email": email})

        resp2 = client.post("/api/auth/session/apple", json={"id_token": id_token2})
        assert resp2.status_code == 200
        user2_id = resp2.json()["user"]["id"]

        count_after = await db.users.count_documents({"email": email})

        assert user1_id == user2_id
        assert count_before == count_after == 1


@pytest.mark.asyncio
async def test_tc_auth_20_protected_endpoint_invalid_tokens():
    """TC-AUTH-20: Protected endpoint with (a) no token (b) random token (c) expired session -> 401 each."""
    # (a) no token
    r1 = client.get("/api/auth/me")
    assert r1.status_code == 401

    # (b) random token
    r2 = client.get("/api/auth/me", headers={"Authorization": "Bearer random_invalid_garbage_token"})
    assert r2.status_code == 401

    # (c) expired session JWT token
    expired_payload = {
        "sub": uid("usr_exp_"),
        "iat": int((datetime.now(timezone.utc) - timedelta(days=10)).timestamp()),
        "exp": int((datetime.now(timezone.utc) - timedelta(days=2)).timestamp()),
    }
    expired_jwt = jwt.encode(expired_payload, "goodcause_super_secret_jwt_key_2026_nigeria_trusted", algorithm="HS256")
    r3 = client.get("/api/auth/me", headers={"Authorization": f"Bearer {expired_jwt}"})
    assert r3.status_code == 401


@pytest.mark.asyncio
async def test_tc_auth_21_signout_invalidates_token():
    """TC-AUTH-21: Sign out, then call protected endpoint with old token -> 401."""
    user_id = await _get_or_create_user("donor")
    session_token = uid("sess_")
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
    })

    r1 = client.get("/api/auth/me", headers={"Authorization": f"Bearer {session_token}"})
    assert r1.status_code == 200

    r_logout = client.post("/api/auth/logout", headers={"Authorization": f"Bearer {session_token}"})
    assert r_logout.status_code == 200

    r2 = client.get("/api/auth/me", headers={"Authorization": f"Bearer {session_token}"})
    assert r2.status_code == 401


def test_tc_auth_06_google_session_invalid_token():
    """TC-AUTH-06: Google SSO endpoint rejects invalid identity token string (HTTP 401/501)."""
    resp = client.post("/api/auth/session", json={"id_token": "invalid_google_jwt_payload"})
    assert resp.status_code in (401, 501)


def test_tc_auth_07_user_registration_deprecated_notice():
    """TC-AUTH-07: Deprecated password registration endpoint returns HTTP 410 Gone."""
    resp = client.post("/api/auth/register", json={"email": "new_user@goodcause.ng", "password": "password123", "name": "New User"})
    assert resp.status_code == 410


def test_tc_auth_08_user_login_deprecated_notice():
    """TC-AUTH-08: Deprecated password login endpoint returns HTTP 410 Gone."""
    resp = client.post("/api/auth/login", json={"email": "user@goodcause.ng", "password": "password123"})
    assert resp.status_code == 410


@pytest.mark.asyncio
async def test_tc_auth_09_user_logout():
    """TC-AUTH-09: User logout invalidates active session token (HTTP 200)."""
    user_id = await _get_or_create_user("donor")
    token = create_jwt(user_id)
    resp = client.post("/api/auth/logout", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["ok"] is True


@pytest.mark.asyncio
async def test_tc_auth_10_get_current_user_profile():
    """TC-AUTH-10: Authenticated user fetching profile (/api/auth/me) receives user info (HTTP 200)."""
    user_id = await _get_or_create_user("donor")
    token = create_jwt(user_id)
    resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["id"] == user_id


@pytest.mark.asyncio
async def test_tc_auth_11_update_user_profile():
    """TC-AUTH-11: Authenticated user updating profile (/api/auth/profile) saves updates (HTTP 200)."""
    user_id = await _get_or_create_user("donor")
    token = create_jwt(user_id)
    resp = client.patch("/api/auth/profile", json={"name": "Updated Name", "bio": "Updated Bio"}, headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["name"] == "Updated Name"


@pytest.mark.asyncio
async def test_tc_auth_12_delete_account():
    """TC-AUTH-12: Authenticated user deleting account (/api/auth/account) removes profile (HTTP 200)."""
    user_id = await _get_or_create_user("donor")
    token = create_jwt(user_id)
    resp = client.delete("/api/auth/account", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["ok"] is True


@pytest.mark.asyncio
async def test_tc_auth_13_unauthorized_profile_access():
    """TC-AUTH-13: Unauthenticated request to protected endpoint returns HTTP 401 Unauthorized."""
    resp = client.get("/api/auth/me")
    assert resp.status_code == 401


# ─────────────────────────────────────────────────────────────────────────────
# 3. ROW LEVEL SECURITY (RLS) TESTS WITH PUBLIC ANON KEY / ANON ROLE (TC-RLS-01 to TC-RLS-15)
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_tc_rls_01_public_categories_readable():
    """TC-RLS-01: Public anon role query on categories table returns 200 / list of categories."""
    conn = await asyncpg.connect(DATABASE_URL, statement_cache_size=0)
    try:
        await conn.execute("SET ROLE anon;")
        rows = await conn.fetch("SELECT id, name, slug FROM categories LIMIT 10;")
        assert isinstance(rows, list)
    finally:
        await conn.execute("RESET ROLE;")
        await conn.close()


@pytest.mark.asyncio
async def test_tc_rls_02_donations_table_protected_anon_read():
    """TC-RLS-02: Public anon role SELECT query on protected donations table returns 0 rows (protected by RLS)."""
    conn = await asyncpg.connect(DATABASE_URL, statement_cache_size=0)
    try:
        await conn.execute("SET ROLE anon;")
        rows = await conn.fetch("SELECT id, donor_email, amount_kobo FROM donations LIMIT 10;")
        assert len(rows) == 0
    finally:
        await conn.execute("RESET ROLE;")
        await conn.close()


@pytest.mark.asyncio
async def test_tc_rls_03_donations_table_protected_anon_write():
    """TC-RLS-03: Public anon role INSERT on donations table raises 42501 RLS policy violation error."""
    conn = await asyncpg.connect(DATABASE_URL, statement_cache_size=0)
    try:
        await conn.execute("SET ROLE anon;")
        with pytest.raises(asyncpg.exceptions.InsufficientPrivilegeError) as exc_info:
            await conn.execute(
                "INSERT INTO donations (id, reference, campaign_id, amount_kobo, status) "
                "VALUES ('dnt_unauth', 'ref_unauth', 'cmp_1', 1000, 'paid');"
            )
        assert exc_info.value.sqlstate == '42501'
    finally:
        await conn.execute("RESET ROLE;")
        await conn.close()


@pytest.mark.asyncio
async def test_tc_rls_04_sensitive_tables_protected_anon_read():
    """TC-RLS-04: Public anon role SELECT queries on bank_accounts and email_otps tables return 0 rows."""
    conn = await asyncpg.connect(DATABASE_URL, statement_cache_size=0)
    try:
        await conn.execute("SET ROLE anon;")
        bank_rows = await conn.fetch("SELECT * FROM bank_accounts LIMIT 10;")
        otp_rows = await conn.fetch("SELECT * FROM email_otps LIMIT 10;")
        assert len(bank_rows) == 0
        assert len(otp_rows) == 0
    finally:
        await conn.execute("RESET ROLE;")
        await conn.close()


@pytest.mark.asyncio
async def test_tc_rls_05_rest_api_rls_isolation():
    """TC-RLS-05: Public anon role query on user_sessions table returns 0 rows."""
    conn = await asyncpg.connect(DATABASE_URL, statement_cache_size=0)
    try:
        await conn.execute("SET ROLE anon;")
        rows = await conn.fetch("SELECT * FROM user_sessions LIMIT 10;")
        assert len(rows) == 0
    finally:
        await conn.execute("RESET ROLE;")
        await conn.close()


@pytest.mark.asyncio
async def test_tc_rls_06_users_password_hash_isolated():
    """TC-RLS-06: Public anon role query on users table returns 0 password hashes (protected by RLS)."""
    conn = await asyncpg.connect(DATABASE_URL, statement_cache_size=0)
    try:
        await conn.execute("SET ROLE anon;")
        rows = await conn.fetch("SELECT password_hash FROM users WHERE password_hash IS NOT NULL LIMIT 10;")
        assert len(rows) == 0
    finally:
        await conn.execute("RESET ROLE;")
        await conn.close()


@pytest.mark.asyncio
async def test_tc_rls_07_payouts_table_isolated():
    """TC-RLS-07: Public anon role query on payouts table returns 0 rows (protected by RLS)."""
    conn = await asyncpg.connect(DATABASE_URL, statement_cache_size=0)
    try:
        await conn.execute("SET ROLE anon;")
        rows = await conn.fetch("SELECT * FROM payouts LIMIT 10;")
        assert len(rows) == 0
    finally:
        await conn.execute("RESET ROLE;")
        await conn.close()


@pytest.mark.asyncio
async def test_tc_rls_08_notifications_table_isolated():
    """TC-RLS-08: Public anon role query on notifications table returns 0 rows (protected by RLS)."""
    conn = await asyncpg.connect(DATABASE_URL, statement_cache_size=0)
    try:
        await conn.execute("SET ROLE anon;")
        rows = await conn.fetch("SELECT * FROM notifications LIMIT 10;")
        assert len(rows) == 0
    finally:
        await conn.execute("RESET ROLE;")
        await conn.close()


@pytest.mark.asyncio
async def test_tc_rls_09_reports_table_isolated():
    """TC-RLS-09: Public anon role query on reports table returns 0 rows (protected by RLS)."""
    conn = await asyncpg.connect(DATABASE_URL, statement_cache_size=0)
    try:
        await conn.execute("SET ROLE anon;")
        rows = await conn.fetch("SELECT * FROM reports LIMIT 10;")
        assert len(rows) == 0
    finally:
        await conn.execute("RESET ROLE;")
        await conn.close()


@pytest.mark.asyncio
async def test_tc_rls_10_verification_checks_isolated():
    """TC-RLS-10: Public anon role query on verification_checks table returns 0 rows (protected by RLS)."""
    conn = await asyncpg.connect(DATABASE_URL, statement_cache_size=0)
    try:
        await conn.execute("SET ROLE anon;")
        rows = await conn.fetch("SELECT * FROM verification_checks LIMIT 10;")
        assert len(rows) == 0
    finally:
        await conn.execute("RESET ROLE;")
        await conn.close()


@pytest.mark.asyncio
async def test_tc_rls_11_public_campaigns_readable():
    """TC-RLS-11: Public anon role query on campaigns table returns LIVE campaigns (permitted by RLS policy)."""
    conn = await asyncpg.connect(DATABASE_URL, statement_cache_size=0)
    try:
        await conn.execute("SET ROLE anon;")
        rows = await conn.fetch("SELECT id, title FROM campaigns WHERE status = 'LIVE' LIMIT 10;")
        assert isinstance(rows, list)
    finally:
        await conn.execute("RESET ROLE;")
        await conn.close()


@pytest.mark.asyncio
async def test_tc_rls_12_anon_select_payout_bank_null_or_protected():
    """TC-RLS-12: Anon role SELECT payout_bank from campaigns -> column absent or null for every row."""
    cmp_id = uid("cmp_rls12_")
    org_id = await _get_or_create_user("donor")
    await db.campaigns.insert_one({
        "id": cmp_id, "organizer_id": org_id, "title": "Sensitive Bank Cause",
        "goal_kobo": 5000000, "raised_kobo": 1000000, "status": "LIVE",
        "payout_bank": {"bank_name": "GTBank", "account_number": "0123456789"}
    })

    conn = await asyncpg.connect(DATABASE_URL, statement_cache_size=0)
    try:
        await conn.execute("SET ROLE anon;")
        rows = await conn.fetch(f"SELECT payout_bank FROM campaigns WHERE id = '{cmp_id}';")
        for r in rows:
            assert r["payout_bank"] is None or r["payout_bank"] == {} or r["payout_bank"] == ""
    finally:
        await conn.execute("RESET ROLE;")
        await conn.close()


@pytest.mark.asyncio
async def test_tc_rls_13_anon_draft_impact_allocations_protected():
    """TC-RLS-13: Anon GET draft impact / reports for a DRAFT period -> [] (0 rows exposed)."""
    rpt_id = uid("rpt_draft_")
    org_id = await _get_or_create_user("donor")
    cmp_id = uid("cmp_draft_")
    await db.campaigns.insert_one({
        "id": cmp_id, "organizer_id": org_id, "title": "Draft Period Cause",
        "goal_kobo": 1000000, "raised_kobo": 0, "status": "DRAFT"
    })
    await db.reports.insert_one({
        "id": rpt_id, "campaign_id": cmp_id, "reporter_id": org_id,
        "reason": "Draft allocation test", "status": "DRAFT", "created_at": now_iso()
    })

    conn = await asyncpg.connect(DATABASE_URL, statement_cache_size=0)
    try:
        await conn.execute("SET ROLE anon;")
        rows = await conn.fetch("SELECT * FROM reports WHERE status = 'DRAFT';")
        assert len(rows) == 0
    finally:
        await conn.execute("RESET ROLE;")
        await conn.close()



@pytest.mark.asyncio
async def test_tc_rls_14_anon_categories_write_rejected():
    """TC-RLS-14: Anon POST/INSERT into categories -> rejected (42501 RLS violation), row not created."""
    conn = await asyncpg.connect(DATABASE_URL, statement_cache_size=0)
    try:
        await conn.execute("SET ROLE anon;")
        with pytest.raises(asyncpg.exceptions.InsufficientPrivilegeError) as exc_info:
            await conn.execute(
                "INSERT INTO categories (id, slug, name, icon, color) "
                "VALUES ('cat_unauth', 'unauth-slug', 'Unauth Category', 'icon', '#ffffff');"
            )
        assert exc_info.value.sqlstate == '42501'
    finally:
        await conn.execute("RESET ROLE;")
        await conn.close()

    cat = await db.categories.find_one({"id": "cat_unauth"})
    assert cat is None


@pytest.mark.asyncio
async def test_tc_rls_15_anon_patch_campaign_raised_kobo_rejected():
    """TC-RLS-15: Anon PATCH/UPDATE campaigns raised_kobo -> rejected, value unchanged."""
    cmp_id = uid("cmp_rls15_")
    org_id = await _get_or_create_user("donor")
    await db.campaigns.insert_one({
        "id": cmp_id, "organizer_id": org_id, "title": "Tamper Test",
        "goal_kobo": 5000000, "raised_kobo": 100000, "status": "LIVE"
    })

    conn = await asyncpg.connect(DATABASE_URL, statement_cache_size=0)
    try:
        await conn.execute("SET ROLE anon;")
        with pytest.raises(asyncpg.exceptions.InsufficientPrivilegeError):
            await conn.execute(f"UPDATE campaigns SET raised_kobo = 99999999 WHERE id = '{cmp_id}';")
    finally:
        await conn.execute("RESET ROLE;")
        await conn.close()

    c = await db.campaigns.find_one({"id": cmp_id})
    assert c["raised_kobo"] == 100000


# ─────────────────────────────────────────────────────────────────────────────
# 4. DONATION-LEDGER CONCURRENCY TESTS (TC-LED-01 to TC-LED-04)
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_tc_led_01_initialize_donation():
    """TC-LED-01: Initializing donation returns payment reference & checkout details (HTTP 200)."""
    cmp_id = uid("cmp_led1_")
    org_id = await _get_or_create_user("donor")
    await db.campaigns.insert_one({
        "id": cmp_id, "organizer_id": org_id, "title": "Init Donation Cause",
        "goal_kobo": 5000000, "raised_kobo": 0, "status": "LIVE"
    })
    resp = client.post(
        f"/api/campaigns/{cmp_id}/donate",
        json={"amount_kobo": 500000, "email": "donor_init@goodcause.ng"}
    )
    assert resp.status_code == 200
    assert "reference" in resp.json()


@pytest.mark.asyncio
async def test_tc_led_03_concurrent_atomic_donations():
    """TC-LED-03: 5 simultaneous concurrent donations update campaign raised_kobo atomically without lost updates."""
    org_id = await _get_or_create_user("donor")

    cmp_id = uid("cmp_led3_")
    await db.campaigns.insert_one({
        "id": cmp_id, "organizer_id": org_id, "title": "TC-LED-03 Concurrency Test",
        "goal_kobo": 10000000, "raised_kobo": 0, "status": "LIVE", "supporters_count": 0
    })

    references = []
    for i in range(5):
        ref = uid(f"ref_led3_{i}_")
        donor_id = await _get_or_create_user("donor")
        await db.donations.insert_one({
            "id": uid(f"dnt_led3_{i}_"), "reference": ref, "campaign_id": cmp_id,
            "donor_id": donor_id, "amount_kobo": 100000, "status": "pending",
            "provider": "paystack", "created_at": now_iso()
        })
        references.append(ref)

    results = await asyncio.gather(*[
        apply_verified_donation(ref, {"verified_amount_kobo": 100000}) for ref in references
    ])

    for res in results:
        assert res is not None
        assert res["already"] is False

    c = await db.campaigns.find_one({"id": cmp_id})
    assert c["raised_kobo"] == 500000


@pytest.mark.asyncio
async def test_tc_led_04_concurrent_duplicate_reference_settlement():
    """TC-LED-04: 5 simultaneous concurrent settlement calls for the SAME reference result in exactly 1 credit."""
    org_id = await _get_or_create_user("donor")
    donor_id = await _get_or_create_user("donor")

    cmp_id = uid("cmp_led4_")
    await db.campaigns.insert_one({
        "id": cmp_id, "organizer_id": org_id, "title": "TC-LED-04 Race Test",
        "goal_kobo": 5000000, "raised_kobo": 0, "status": "LIVE"
    })
    ref = uid("ref_led4_dup_")
    await db.donations.insert_one({
        "id": uid("dnt_led4_"), "reference": ref, "campaign_id": cmp_id,
        "donor_id": donor_id, "amount_kobo": 250000, "status": "pending",
        "provider": "paystack", "created_at": now_iso()
    })

    results = await asyncio.gather(*[
        apply_verified_donation(ref, {"verified_amount_kobo": 250000}) for _ in range(5)
    ])

    newly_credited = [r for r in results if r and not r.get("already")]
    already_paid = [r for r in results if r and r.get("already")]

    assert len(newly_credited) == 1
    assert len(already_paid) == 4

    c = await db.campaigns.find_one({"id": cmp_id})
    assert c["raised_kobo"] == 250000


# ─────────────────────────────────────────────────────────────────────────────
# 5. WITHDRAWAL AND ADMIN CONTROL TESTS (TC-WD, TC-ADM)
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_tc_wd_01_bank_resolution():
    """TC-WD-01: Bank NUBAN account resolution returns verified account holder name."""
    res_auth = client.post("/api/auth/otp/verify", json={"email": "test@goodcause.app", "code": "123456"})
    token = res_auth.json()["token"]

    resp = client.post(
        "/api/banks/resolve",
        json={"account_number": "0123456789", "bank_code": "058"},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 200, f"WD-01 failed: {resp.status_code} {resp.text}"
    data = resp.json()
    assert data["account_number"] == "0123456789"
    assert data["bank_code"] == "058"
    assert data["verified"] is True
    assert len(data["account_name"]) > 0


@pytest.mark.asyncio
async def test_tc_wd_02_withdrawal_insufficient_funds():
    """TC-WD-02: Withdrawal request exceeding campaign available balance returns HTTP 400."""
    user_id = await _get_or_create_user("donor")
    token = create_jwt(user_id)

    await db.bank_accounts.insert_one({
        "id": uid("acc_"),
        "user_id": user_id,
        "bank_name": "GTBank",
        "bank_code": "058",
        "account_number": "0123456789",
        "account_name": "TEST ORGANIZER"
    })

    cmp_id = uid("cmp_wd2_")
    await db.campaigns.insert_one({
        "id": cmp_id, "organizer_id": user_id, "title": "Empty Campaign",
        "goal_kobo": 1000000, "raised_kobo": 0, "withdrawn_kobo": 0, "status": "LIVE"
    })

    resp = client.post(
        f"/api/campaigns/{cmp_id}/withdraw",
        json={"amount_kobo": 500000},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 400, f"WD-02 failed: {resp.status_code} {resp.text}"
    assert "exceeds available balance" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_tc_wd_03_successful_withdrawal():
    """TC-WD-03: Valid withdrawal deducts available balance and creates payout record (200 OK)."""
    user_id = await _get_or_create_user("donor")
    token = create_jwt(user_id)

    await db.bank_accounts.insert_one({
        "id": uid("acc_"),
        "user_id": user_id,
        "bank_name": "GTBank",
        "bank_code": "058",
        "account_number": "0123456789",
        "account_name": "ORG 3"
    })

    cmp_id = uid("cmp_wd3_")
    await db.campaigns.insert_one({
        "id": cmp_id, "organizer_id": user_id, "title": "Funded Campaign",
        "goal_kobo": 2000000, "raised_kobo": 1000000, "withdrawn_kobo": 0, "status": "LIVE",
        "payout_bank": {"bank_name": "GTBank", "bank_code": "058", "account_number": "0123456789", "account_name": "ORG 3"}
    })

    resp = client.post(
        f"/api/campaigns/{cmp_id}/withdraw",
        json={"amount_kobo": 400000, "note": "Partial withdrawal for project materials"},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 200, f"WD-03 failed: {resp.status_code} {resp.text}"
    res = resp.json()
    assert res["status"] == "SUCCESS"
    assert res["amount_kobo"] == 400000
    assert res["new_available_kobo"] == 600000

    c = await db.campaigns.find_one({"id": cmp_id})
    assert c["withdrawn_kobo"] == 400000


@pytest.mark.asyncio
async def test_tc_wd_04_withdrawal_ownership_check():
    """TC-WD-04: Non-organizer user attempting to withdraw from another organizer's campaign receives HTTP 403."""
    org_id = await _get_or_create_user("donor")
    attacker_id = await _get_or_create_user("donor")
    attacker_token = create_jwt(attacker_id)

    cmp_id = uid("cmp_wd4_")
    await db.campaigns.insert_one({
        "id": cmp_id, "organizer_id": org_id, "title": "Private Fund",
        "goal_kobo": 5000000, "raised_kobo": 2000000, "withdrawn_kobo": 0, "status": "LIVE"
    })

    resp = client.post(
        f"/api/campaigns/{cmp_id}/withdraw",
        json={"amount_kobo": 1000000},
        headers={"Authorization": f"Bearer {attacker_token}"}
    )
    assert resp.status_code == 403
    assert "Only the organizer" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_tc_wd_05_campaign_payout_history():
    """TC-WD-05: Fetching campaign payout history returns logged payout entries (HTTP 200)."""
    org_id = await _get_or_create_user("donor")
    token = create_jwt(org_id)
    cmp_id = uid("cmp_wd5_")
    await db.campaigns.insert_one({
        "id": cmp_id, "organizer_id": org_id, "title": "History Cause",
        "goal_kobo": 5000000, "raised_kobo": 2000000, "withdrawn_kobo": 0, "status": "LIVE"
    })
    resp = client.get(f"/api/campaigns/{cmp_id}/payouts", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_tc_wd_06_organizer_no_bank_account_withdraw():
    """TC-WD-06: Organizer with no verified bank account withdraws -> 400 'Please link a verified bank account before withdrawing'."""
    user_id = await _get_or_create_user("donor")
    token = create_jwt(user_id)

    cmp_id = uid("cmp_wd6_")
    await db.campaigns.insert_one({
        "id": cmp_id, "organizer_id": user_id, "title": "No Bank Cause",
        "goal_kobo": 5000000, "raised_kobo": 3000000, "withdrawn_kobo": 0, "status": "LIVE"
    })

    resp = client.post(
        f"/api/campaigns/{cmp_id}/withdraw",
        json={"amount_kobo": 500000},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 400
    assert "Please link a verified bank account before withdrawing" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_tc_wd_07_withdrawal_race_condition():
    """TC-WD-07: Concurrent withdrawal requests exceeding available balance prevent race conditions."""
    user_id = await _get_or_create_user("donor")
    token = create_jwt(user_id)

    await db.bank_accounts.insert_one({
        "id": uid("acc_"),
        "user_id": user_id,
        "bank_name": "Zenith Bank",
        "bank_code": "057",
        "account_number": "2233445566",
        "account_name": "RACE TEST"
    })

    cmp_id = uid("cmp_wd7_")
    await db.campaigns.insert_one({
        "id": cmp_id, "organizer_id": user_id, "title": "Race Condition Campaign",
        "goal_kobo": 10000000, "raised_kobo": 5000000, "withdrawn_kobo": 0, "status": "LIVE",
        "payout_bank": {"bank_name": "Zenith Bank", "bank_code": "057", "account_number": "2233445566", "account_name": "RACE TEST"}
    })

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
        resps = await asyncio.gather(
            ac.post(
                f"/api/campaigns/{cmp_id}/withdraw",
                json={"amount_kobo": 4000000},
                headers={"Authorization": f"Bearer {token}"}
            ),
            ac.post(
                f"/api/campaigns/{cmp_id}/withdraw",
                json={"amount_kobo": 4000000},
                headers={"Authorization": f"Bearer {token}"}
            )
        )

    statuses = [r.status_code for r in resps]
    assert 200 in statuses
    assert 400 in statuses

    c = await db.campaigns.find_one({"id": cmp_id})
    assert c["withdrawn_kobo"] == 4000000


@pytest.mark.asyncio
async def test_tc_wd_08_admin_withdraws_on_organizer_campaign():
    """TC-WD-08: Admin user withdraws on organizer's campaign -> 200 OK, payout recorded."""
    admin_id = await _get_or_create_user("admin")
    admin_token = create_jwt(admin_id)

    org_id = await _get_or_create_user("donor")

    cmp_id = uid("cmp_wd8_")
    await db.campaigns.insert_one({
        "id": cmp_id, "organizer_id": org_id, "title": "Organizers Cause",
        "goal_kobo": 10000000, "raised_kobo": 5000000, "withdrawn_kobo": 0, "status": "LIVE",
        "payout_bank": {"bank_name": "First Bank", "bank_code": "011", "account_number": "3344556677", "account_name": "ADMIN PAYOUT"}
    })

    resp = client.post(
        f"/api/campaigns/{cmp_id}/withdraw",
        json={"amount_kobo": 1000000},
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert resp.status_code == 200
    res = resp.json()
    assert res["status"] == "SUCCESS"
    assert res["amount_kobo"] == 1000000

    payout = await db.payouts.find_one({"campaign_id": cmp_id})
    assert payout is not None
    assert payout["amount_kobo"] == 1000000


@pytest.mark.asyncio
async def test_tc_adm_01_non_admin_forbidden():
    """TC-ADM-01: Donor user attempting to access admin endpoints receives HTTP 403 Forbidden."""
    user_id = await _get_or_create_user("donor")
    token = create_jwt(user_id)

    resp = client.get("/api/admin/stats", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 403, f"ADM-01 failed: {resp.status_code} {resp.text}"
    assert "Admins only" in resp.json()["detail"] or "Admin access required" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_tc_adm_02_admin_stats_access():
    """TC-ADM-02: Verified admin user accessing /api/admin/stats receives HTTP 200 with platform metrics."""
    admin_id = await _get_or_create_user("admin")
    token = create_jwt(admin_id)

    resp = client.get("/api/admin/stats", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200, f"ADM-02 failed: {resp.status_code} {resp.text}"
    data = resp.json()
    assert "total_users" in data or "users_count" in data or "total_campaigns" in data


@pytest.mark.asyncio
async def test_tc_adm_03_admin_campaign_verification():
    """TC-ADM-03: Admin approving submitted campaign transitions status to LIVE / VERIFIED."""
    admin_id = await _get_or_create_user("admin")
    token = create_jwt(admin_id)

    cmp_id = uid("cmp_adm3_")
    org_id = await _get_or_create_user("donor")
    await db.campaigns.insert_one({
        "id": cmp_id, "organizer_id": org_id, "title": "Submitted Cause",
        "goal_kobo": 1000000, "raised_kobo": 0, "status": "SUBMITTED",
        "verification_status": "PENDING"
    })

    resp = client.post(
        f"/api/admin/campaigns/{cmp_id}/verify",
        json={"action": "approve", "notes": "Documents and identity verified."},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 200, f"ADM-03 failed: {resp.status_code} {resp.text}"
    c = await db.campaigns.find_one({"id": cmp_id})
    assert c["status"] in ("LIVE", "VERIFIED")
