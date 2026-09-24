-- Migration: Add Fan Zone tables
-- Run this against your Supabase PostgreSQL instance.

CREATE TABLE IF NOT EXISTS fan_zones (
    user_id VARCHAR(64) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    headline VARCHAR(160),
    thank_you_message VARCHAR(500),
    cover_image TEXT,
    profile_picture TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- If upgrading an existing installation:
ALTER TABLE fan_zones ADD COLUMN IF NOT EXISTS cover_image TEXT;
ALTER TABLE fan_zones ADD COLUMN IF NOT EXISTS profile_picture TEXT;

CREATE TABLE IF NOT EXISTS fan_gifts (
    id VARCHAR(64) PRIMARY KEY,
    reference VARCHAR(120) UNIQUE NOT NULL,
    recipient_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    donor_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    donor_name VARCHAR(160),
    donor_email VARCHAR(320),
    amount_kobo BIGINT NOT NULL CHECK (amount_kobo > 0),
    anonymous BOOLEAN NOT NULL DEFAULT FALSE,
    message TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    provider VARCHAR(32) NOT NULL DEFAULT 'sandbox',
    is_test BOOLEAN NOT NULL DEFAULT FALSE,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fan_gifts_recipient ON fan_gifts(recipient_id);
CREATE INDEX IF NOT EXISTS idx_fan_gifts_donor ON fan_gifts(donor_id);
CREATE INDEX IF NOT EXISTS idx_fan_gifts_status ON fan_gifts(status);
CREATE INDEX IF NOT EXISTS idx_fan_gifts_reference ON fan_gifts(reference);
