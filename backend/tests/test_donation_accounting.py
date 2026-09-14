import importlib
import importlib.util


def _policy():
    assert importlib.util.find_spec("donation_policy") is not None, (
        "Donation identity and presentation policy is missing"
    )
    return importlib.import_module("donation_policy")


def test_anonymous_donation_keeps_private_owner_but_masks_public_identity():
    policy = _policy()
    identity = policy.donation_identity(
        {"id": "usr_123", "name": "Ada Okafor", "email": "ada@example.com"},
        anonymous=True,
    )

    assert identity == {
        "donor_id": "usr_123",
        "donor_name": "Ada Okafor",
        "donor_email": "ada@example.com",
        "anonymous": True,
    }

    public = policy.public_donation({
        "id": "dnt_1",
        **identity,
        "amount_kobo": 500_000,
        "message": "Please contact me privately",
        "paid_at": "2026-09-13T12:00:00+00:00",
        "thanked": False,
    })
    assert public["name"] == "Anonymous"
    assert public["amount_kobo"] == 500_000
    assert public["message"] == ""
    assert public["can_thank"] is False
    assert "donor_email" not in public
    assert "donor_id" not in public


def test_named_donation_displays_snapshot_name_amount_and_message():
    policy = _policy()
    public = policy.public_donation({
        "id": "dnt_2",
        "donor_id": "usr_456",
        "donor_name": "Chidi Obi",
        "donor_email": "chidi@example.com",
        "anonymous": False,
        "amount_kobo": 1_000_000,
        "message": "Wishing you success",
        "paid_at": "2026-09-13T12:00:00+00:00",
        "thanked": False,
    })
    assert public == {
        "id": "dnt_2",
        "name": "Chidi Obi",
        "amount_kobo": 1_000_000,
        "message": "Wishing you success",
        "anonymous": False,
        "created_at": "2026-09-13T12:00:00+00:00",
        "can_thank": True,
        "thanked": False,
    }


def test_paystack_transaction_normalization_keeps_reconciliation_fields():
    policy = _policy()
    normalized = policy.normalize_paystack_transaction({
        "id": 4099260516,
        "reference": "don_abc",
        "status": "success",
        "amount": 750_000,
        "currency": "NGN",
        "channel": "card",
        "fees": 11_250,
        "paid_at": "2026-09-13T12:00:00.000Z",
    })
    assert normalized == {
        "status": "success",
        "reference": "don_abc",
        "verified_amount_kobo": 750_000,
        "currency": "NGN",
        "provider_transaction_id": "4099260516",
        "payment_channel": "card",
        "provider_fee_kobo": 11_250,
        "provider_paid_at": "2026-09-13T12:00:00.000Z",
    }


def test_verified_payment_requires_success_ngn_reference_and_exact_amount():
    policy = _policy()
    donation = {"reference": "don_abc", "amount_kobo": 750_000}
    payment = {
        "status": "success",
        "reference": "don_abc",
        "verified_amount_kobo": 750_000,
        "currency": "NGN",
    }
    assert policy.payment_matches_donation(payment, donation) is True
    assert policy.payment_matches_donation({**payment, "verified_amount_kobo": 749_999}, donation) is False
    assert policy.payment_matches_donation({**payment, "reference": "don_other"}, donation) is False
    assert policy.payment_matches_donation({**payment, "status": "failed"}, donation) is False
