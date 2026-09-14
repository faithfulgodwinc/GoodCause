from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MIGRATION = ROOT / "migrations" / "20260913_impact_commitment.sql"


def test_impact_migration_defines_append_only_financial_ledger():
    sql = MIGRATION.read_text(encoding="utf-8")

    assert "CREATE TABLE IF NOT EXISTS impact_periods" in sql
    assert "CREATE TABLE IF NOT EXISTS impact_allocations" in sql
    assert "CREATE TABLE IF NOT EXISTS impact_adjustments" in sql
    assert "CHECK (status IN ('DRAFT', 'CALCULATED', 'APPROVED', 'PUBLISHED', 'CLOSED'))" in sql
    assert "CHECK (status IN ('ALLOCATED', 'PAID', 'CANCELLED'))" in sql
    assert "UNIQUE (period_id, campaign_id)" in sql
    assert "WHERE payment_reference IS NOT NULL" in sql
    assert "REFERENCES campaigns(id)" in sql
    assert "REFERENCES users(id)" in sql
    assert "ADD COLUMN IF NOT EXISTS payout_bank JSONB" in sql
    assert "verification->>'status' = 'VERIFIED'" in sql


def test_canonical_schema_matches_impact_migration_tables():
    schema = (ROOT / "schema.sql").read_text(encoding="utf-8")

    for table in ("impact_periods", "impact_allocations", "impact_adjustments"):
        assert f"CREATE TABLE IF NOT EXISTS {table}" in schema
    assert "payout_bank JSONB" in schema
