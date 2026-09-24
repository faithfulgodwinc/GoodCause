-- Migration: Fan Zone Payouts / Withdrawals
-- Run against your Supabase PostgreSQL instance.

-- Track how much the fan zone owner has already withdrawn
ALTER TABLE fan_zones ADD COLUMN IF NOT EXISTS withdrawn_kobo BIGINT NOT NULL DEFAULT 0;

-- Per-withdrawal records for fan zone (mirrors the payouts table for campaigns)
CREATE TABLE IF NOT EXISTS fan_zone_payouts (
    id           VARCHAR(64) PRIMARY KEY,
    user_id      VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount_kobo  BIGINT NOT NULL CHECK (amount_kobo > 0),
    currency     VARCHAR(10) NOT NULL DEFAULT 'NGN',
    bank_name    VARCHAR(120) NOT NULL,
    account_number VARCHAR(20) NOT NULL,
    account_name VARCHAR(160) NOT NULL,
    status       VARCHAR(30) NOT NULL DEFAULT 'SUCCESS',
    reference    VARCHAR(120),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fan_zone_payouts_user ON fan_zone_payouts(user_id);
