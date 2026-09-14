from pathlib import Path


REPO = Path(__file__).resolve().parents[2]


def _read(relative: str) -> str:
    return (REPO / relative).read_text(encoding="utf-8")


def test_membership_copy_defines_the_short_accurate_purchase_disclosure():
    copy = _read("frontend/src/constants/impact-commitment.ts")

    assert "80%" in copy
    assert "net proceeds" in copy
    assert "Store deductions, refunds and adjustments apply" in copy
    assert "separate from GoodCause Membership" in copy


def test_purchase_surfaces_use_the_canonical_disclosures():
    payment = _read("frontend/app/onboarding/payment.tsx")
    paywall = _read("frontend/app/paywall.tsx")
    donation = _read("frontend/app/donate/[id].tsx")

    assert "IMPACT_DISCLOSURE_COMPACT" in payment
    assert "IMPACT_DISCLOSURE_COMPACT" in paywall
    assert "DIRECT_DONATION_DISCLOSURE" in donation
