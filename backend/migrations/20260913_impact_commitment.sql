BEGIN;

ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS payout_bank JSONB;

UPDATE campaigns
SET verification_status = 'VERIFIED'
WHERE verification->>'status' = 'VERIFIED'
  AND verification_status <> 'VERIFIED';

CREATE TABLE IF NOT EXISTS impact_periods (
    id VARCHAR(64) PRIMARY KEY,
    period_key VARCHAR(32) UNIQUE NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'DRAFT'
        CHECK (status IN ('DRAFT', 'CALCULATED', 'APPROVED', 'PUBLISHED', 'CLOSED')),
    apple_net_kobo BIGINT NOT NULL DEFAULT 0 CHECK (apple_net_kobo >= 0),
    google_net_kobo BIGINT NOT NULL DEFAULT 0 CHECK (google_net_kobo >= 0),
    adjustments_kobo BIGINT NOT NULL DEFAULT 0,
    net_proceeds_kobo BIGINT NOT NULL DEFAULT 0 CHECK (net_proceeds_kobo >= 0),
    current_impact_kobo BIGINT NOT NULL DEFAULT 0 CHECK (current_impact_kobo >= 0),
    operating_kobo BIGINT NOT NULL DEFAULT 0 CHECK (operating_kobo >= 0),
    opening_rollover_kobo BIGINT NOT NULL DEFAULT 0 CHECK (opening_rollover_kobo >= 0),
    available_impact_kobo BIGINT NOT NULL DEFAULT 0 CHECK (available_impact_kobo >= 0),
    allocated_kobo BIGINT NOT NULL DEFAULT 0 CHECK (allocated_kobo >= 0),
    closing_rollover_kobo BIGINT NOT NULL DEFAULT 0 CHECK (closing_rollover_kobo >= 0),
    reconciliation_reference TEXT,
    calculated_at TIMESTAMPTZ,
    approved_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    created_by VARCHAR(64) NOT NULL REFERENCES users(id),
    approved_by VARCHAR(64) REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS impact_allocations (
    id VARCHAR(64) PRIMARY KEY,
    period_id VARCHAR(64) NOT NULL REFERENCES impact_periods(id) ON DELETE CASCADE,
    campaign_id VARCHAR(64) NOT NULL REFERENCES campaigns(id),
    campaign_title_snapshot TEXT NOT NULL,
    remaining_goal_snapshot_kobo BIGINT NOT NULL CHECK (remaining_goal_snapshot_kobo > 0),
    amount_kobo BIGINT NOT NULL CHECK (amount_kobo > 0),
    status VARCHAR(16) NOT NULL DEFAULT 'ALLOCATED'
        CHECK (status IN ('ALLOCATED', 'PAID', 'CANCELLED')),
    payment_reference VARCHAR(160),
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (period_id, campaign_id)
);

CREATE TABLE IF NOT EXISTS impact_adjustments (
    id VARCHAR(64) PRIMARY KEY,
    period_id VARCHAR(64) NOT NULL REFERENCES impact_periods(id) ON DELETE CASCADE,
    allocation_id VARCHAR(64) REFERENCES impact_allocations(id) ON DELETE SET NULL,
    amount_kobo BIGINT NOT NULL CHECK (amount_kobo <> 0),
    reason_code VARCHAR(64) NOT NULL,
    explanation TEXT NOT NULL CHECK (LENGTH(TRIM(explanation)) > 0),
    created_by VARCHAR(64) NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_impact_periods_status ON impact_periods(status);
CREATE INDEX IF NOT EXISTS idx_impact_periods_published ON impact_periods(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_impact_allocations_period ON impact_allocations(period_id);
CREATE INDEX IF NOT EXISTS idx_impact_allocations_campaign ON impact_allocations(campaign_id);
CREATE INDEX IF NOT EXISTS idx_impact_allocations_status ON impact_allocations(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_impact_allocations_payment_reference
    ON impact_allocations(payment_reference)
    WHERE payment_reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_impact_adjustments_period ON impact_adjustments(period_id);

COMMIT;
