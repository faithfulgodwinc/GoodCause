import os

import pytest

os.environ.setdefault("JWT_SECRET", "impact-route-test-secret")

from impact_ledger import payment_sql_is_atomic
from routes_impact import public_period, settlement_totals, validate_transition


def test_settlement_totals_apply_signed_adjustments_and_preserve_kobo():
    assert settlement_totals(60_000, 40_001, -1) == {
        "net_proceeds_kobo": 100_000,
        "current_impact_kobo": 80_000,
        "operating_kobo": 20_000,
    }


def test_settlement_totals_reject_negative_result():
    with pytest.raises(ValueError, match="negative"):
        settlement_totals(0, 0, -1)


@pytest.mark.parametrize("current,target", [
    ("DRAFT", "CALCULATED"),
    ("CALCULATED", "APPROVED"),
    ("APPROVED", "PUBLISHED"),
    ("PUBLISHED", "CLOSED"),
])
def test_period_lifecycle_allows_only_forward_neighbor_transitions(current, target):
    validate_transition(current, target)


@pytest.mark.parametrize("current,target", [
    ("DRAFT", "APPROVED"),
    ("APPROVED", "CALCULATED"),
    ("CLOSED", "DRAFT"),
])
def test_period_lifecycle_rejects_skips_and_reversals(current, target):
    with pytest.raises(ValueError, match="Invalid impact period transition"):
        validate_transition(current, target)


def test_public_period_uses_an_allow_list_and_hides_reconciliation_data():
    result = public_period({
        "id": "ipr_1",
        "period_key": "2026-09",
        "status": "PUBLISHED",
        "net_proceeds_kobo": 100_000,
        "current_impact_kobo": 80_000,
        "operating_kobo": 20_000,
        "opening_rollover_kobo": 500,
        "available_impact_kobo": 80_500,
        "allocated_kobo": 80_000,
        "closing_rollover_kobo": 500,
        "published_at": "2026-10-01T00:00:00+00:00",
        "reconciliation_reference": "private-report.pdf",
        "created_by": "admin_1",
        "approved_by": "admin_2",
    }, [{
        "campaign_id": "cmp_1",
        "campaign_title_snapshot": "School fees",
        "amount_kobo": 80_000,
        "status": "PAID",
    }])

    assert result["paid_kobo"] == 80_000
    assert result["pending_kobo"] == 0
    assert result["allocations"][0]["campaign_title"] == "School fees"
    assert "reconciliation_reference" not in result
    assert "created_by" not in result
    assert "approved_by" not in result


def test_impact_payment_statement_claims_and_credits_in_one_sql_statement():
    assert payment_sql_is_atomic() is True
