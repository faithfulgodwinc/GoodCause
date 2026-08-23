"""Payment provider abstraction. Paystack when configured; clearly-labelled sandbox otherwise.

Never trusts a client-side success signal. Real money only credits after Paystack
server-side verification (via webhook or verify endpoint). The sandbox path exists purely
so the donation UX can be exercised before live keys are added; every sandbox transaction is
recorded truthfully in the ledger with provider='sandbox' and test=True.
"""
import os
import hmac
import hashlib
import httpx
from abc import ABC, abstractmethod

PAYSTACK_BASE = "https://api.paystack.co"


def paystack_configured() -> bool:
    return bool(os.environ.get("PAYSTACK_SECRET_KEY"))


class PaymentProvider(ABC):
    name = "base"

    @abstractmethod
    async def initialize(self, *, reference: str, amount_kobo: int, email: str,
                         callback_url: str, metadata: dict) -> dict:
        ...

    @abstractmethod
    async def verify(self, reference: str) -> dict:
        """Return {status: 'success'|'failed'|'pending', amount_kobo, currency}."""
        ...


class PaystackProvider(PaymentProvider):
    name = "paystack"

    def __init__(self):
        self.secret = os.environ["PAYSTACK_SECRET_KEY"]

    def _headers(self):
        return {"Authorization": f"Bearer {self.secret}", "Content-Type": "application/json"}

    async def initialize(self, *, reference, amount_kobo, email, callback_url, metadata) -> dict:
        body = {
            "email": email, "amount": amount_kobo, "currency": "NGN",
            "reference": reference, "callback_url": callback_url, "metadata": metadata,
        }
        async with httpx.AsyncClient(timeout=20) as http:
            resp = await http.post(f"{PAYSTACK_BASE}/transaction/initialize",
                                   headers=self._headers(), json=body)
        if resp.is_error:
            raise RuntimeError("paystack_init_failed")
        data = resp.json()["data"]
        return {"authorization_url": data["authorization_url"],
                "access_code": data.get("access_code")}

    async def verify(self, reference: str) -> dict:
        async with httpx.AsyncClient(timeout=20) as http:
            resp = await http.get(f"{PAYSTACK_BASE}/transaction/verify/{reference}",
                                  headers=self._headers())
        resp.raise_for_status()
        body = resp.json()
        if not body.get("status"):
            return {"status": "failed"}
        d = body["data"]
        return {"status": d.get("status"), "amount_kobo": d.get("amount"),
                "currency": d.get("currency"), "raw": d}

    @staticmethod
    def verify_signature(raw: bytes, signature: str) -> bool:
        secret = os.environ.get("PAYSTACK_WEBHOOK_SECRET") or os.environ.get("PAYSTACK_SECRET_KEY", "")
        expected = hmac.new(secret.encode(), raw, hashlib.sha512).hexdigest()
        return bool(signature) and hmac.compare_digest(expected, signature)


class SandboxProvider(PaymentProvider):
    """Deterministic test provider — NO real money. Completion is triggered server-side
    only, via an explicit /sandbox-complete call, and stored as test=True."""
    name = "sandbox"

    async def initialize(self, *, reference, amount_kobo, email, callback_url, metadata) -> dict:
        return {"authorization_url": None, "access_code": None, "sandbox": True}

    async def verify(self, reference: str) -> dict:
        # Sandbox verification is handled explicitly in the donations route.
        return {"status": "pending"}


def get_provider() -> PaymentProvider:
    return PaystackProvider() if paystack_configured() else SandboxProvider()


def provider_mode() -> str:
    return "live" if paystack_configured() else "sandbox"
