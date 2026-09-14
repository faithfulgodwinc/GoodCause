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


def test_transparency_screen_has_an_honest_first_report_empty_state():
    screen = _read("frontend/app/impact-commitment.tsx")

    assert "First report pending" in screen
    assert 'api<ImpactLatest>("/impact/latest"' in screen


def test_home_has_no_fabricated_community_metric_floors_or_fallbacks():
    backend_home = _read("backend/routes_campaigns.py")
    frontend_home = _read("frontend/app/(tabs)/index.tsx")
    paywall = _read("frontend/app/paywall.tsx")

    forbidden = ("max(members_count, 1284)", "max(given_kobo, 840000000)",
                 "max(causes_helped_count, 145)", '"1,284"', '"₦8.4M"', "2,400+")
    combined = backend_home + frontend_home + paywall
    for claim in forbidden:
        assert claim not in combined


def test_in_app_and_public_policies_define_the_same_financial_relationship():
    policies = "\n".join([
        _read("frontend/app/privacy.tsx"),
        _read("frontend/public/privacy.html"),
        _read("frontend/public/terms.html"),
    ])

    assert policies.count("80%") >= 3
    assert policies.count("20%") >= 3
    assert "confirmed net membership proceeds" in policies
    assert "restricted rollover" in policies
    assert "not a direct charitable donation" in policies
    assert "Paystack" in policies
    assert "RevenueCat manages" in policies
    assert "tax-deductible" in policies
