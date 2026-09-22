-- ====================================================================
-- GoodCause Supabase PostgreSQL Schema
-- Platform: Supabase (PostgreSQL 15+)
-- Description: Full relational schema for crowdfunding, donations,
--              campaigns, verification, circles, and notifications.
-- ====================================================================

-- Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. USERS
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    name VARCHAR(120) NOT NULL,
    picture TEXT,
    role VARCHAR(32) NOT NULL DEFAULT 'donor', -- 'donor', 'admin'
    bio TEXT,
    verified_organizer BOOLEAN NOT NULL DEFAULT FALSE,
    auth_provider VARCHAR(32) NOT NULL DEFAULT 'password', -- 'password', 'google'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- 2. CATEGORIES
CREATE TABLE IF NOT EXISTS categories (
    id VARCHAR(64) PRIMARY KEY,
    slug VARCHAR(64) UNIQUE NOT NULL,
    name VARCHAR(120) NOT NULL,
    icon VARCHAR(64) NOT NULL,
    color VARCHAR(32) NOT NULL,
    "order" INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_categories_order ON categories("order" ASC);

-- 3. CAMPAIGNS
CREATE TABLE IF NOT EXISTS campaigns (
    id VARCHAR(64) PRIMARY KEY,
    organizer_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id VARCHAR(64) REFERENCES categories(id) ON DELETE SET NULL,
    title VARCHAR(160) NOT NULL,
    summary TEXT,
    story TEXT,
    goal_kobo BIGINT NOT NULL CHECK (goal_kobo > 0),
    raised_kobo BIGINT NOT NULL DEFAULT 0 CHECK (raised_kobo >= 0),
    currency VARCHAR(16) NOT NULL DEFAULT 'NGN',
    supporters_count INT NOT NULL DEFAULT 0,
    updates_count INT NOT NULL DEFAULT 0,
    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT', -- 'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'VERIFIED', 'LIVE', 'PAUSED', 'COMPLETED', 'REJECTED', 'SUSPENDED'
    verification_status VARCHAR(32) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'IN_REVIEW', 'VERIFIED', 'REQUIRES_MORE_INFORMATION', 'REJECTED'
    verification JSONB NOT NULL DEFAULT '{"status": "PENDING", "checks": {}}'::jsonb,
    featured BOOLEAN NOT NULL DEFAULT FALSE,
    urgent BOOLEAN NOT NULL DEFAULT FALSE,
    cover_image TEXT,
    hero_video TEXT,
    gallery JSONB NOT NULL DEFAULT '[]'::jsonb,
    beneficiary JSONB NOT NULL DEFAULT '{}'::jsonb,
    payout_bank JSONB,
    location JSONB NOT NULL DEFAULT '{"country": "NG"}'::jsonb,
    milestones_reached JSONB NOT NULL DEFAULT '[]'::jsonb,
    deadline TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ,
    last_update_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_organizer ON campaigns(organizer_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_category ON campaigns(category_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_featured ON campaigns(featured);
CREATE INDEX IF NOT EXISTS idx_campaigns_urgent ON campaigns(urgent);
CREATE INDEX IF NOT EXISTS idx_campaigns_published_at ON campaigns(published_at DESC);

-- 4. CAMPAIGN BUDGET ITEMS
CREATE TABLE IF NOT EXISTS campaign_budget_items (
    id VARCHAR(64) PRIMARY KEY,
    campaign_id VARCHAR(64) NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    item VARCHAR(255) NOT NULL,
    amount_kobo BIGINT NOT NULL CHECK (amount_kobo >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_budget_campaign ON campaign_budget_items(campaign_id);

-- 5. DONATIONS
CREATE TABLE IF NOT EXISTS donations (
    id VARCHAR(64) PRIMARY KEY,
    reference VARCHAR(120) UNIQUE NOT NULL,
    campaign_id VARCHAR(64) NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    donor_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    donor_name VARCHAR(160),
    donor_email VARCHAR(320),
    amount_kobo BIGINT NOT NULL CHECK (amount_kobo > 0),
    anonymous BOOLEAN NOT NULL DEFAULT FALSE,
    message TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'pending', -- 'pending', 'paid', 'failed', 'refunded'
    provider VARCHAR(32) NOT NULL DEFAULT 'sandbox', -- 'paystack', 'sandbox'
    is_test BOOLEAN NOT NULL DEFAULT FALSE,
    paid_at TIMESTAMPTZ,
    verified_amount_kobo BIGINT,
    provider_transaction_id VARCHAR(32),
    payment_channel VARCHAR(64),
    provider_fee_kobo BIGINT,
    provider_paid_at TIMESTAMPTZ,
    accounted_at TIMESTAMPTZ,
    thanked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE donations ADD COLUMN IF NOT EXISTS donor_name VARCHAR(160);
ALTER TABLE donations ADD COLUMN IF NOT EXISTS donor_email VARCHAR(320);
ALTER TABLE donations ADD COLUMN IF NOT EXISTS verified_amount_kobo BIGINT;
ALTER TABLE donations ADD COLUMN IF NOT EXISTS provider_transaction_id VARCHAR(32);
ALTER TABLE donations ADD COLUMN IF NOT EXISTS payment_channel VARCHAR(64);
ALTER TABLE donations ADD COLUMN IF NOT EXISTS provider_fee_kobo BIGINT;
ALTER TABLE donations ADD COLUMN IF NOT EXISTS provider_paid_at TIMESTAMPTZ;
ALTER TABLE donations ADD COLUMN IF NOT EXISTS accounted_at TIMESTAMPTZ;
ALTER TABLE donations ADD COLUMN IF NOT EXISTS thanked BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_donations_ref ON donations(reference);
CREATE INDEX IF NOT EXISTS idx_donations_campaign ON donations(campaign_id);
CREATE INDEX IF NOT EXISTS idx_donations_donor ON donations(donor_id);
CREATE INDEX IF NOT EXISTS idx_donations_status ON donations(status);

-- 6. CAMPAIGN UPDATES
CREATE TABLE IF NOT EXISTS campaign_updates (
    id VARCHAR(64) PRIMARY KEY,
    campaign_id VARCHAR(64) NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    title VARCHAR(160) NOT NULL,
    body TEXT NOT NULL,
    image TEXT,
    milestone INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_updates_campaign ON campaign_updates(campaign_id);

-- 7. CAMPAIGN FOLLOWERS & SAVED
CREATE TABLE IF NOT EXISTS campaign_followers (
    campaign_id VARCHAR(64) NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (campaign_id, user_id)
);

CREATE TABLE IF NOT EXISTS saved_campaigns (
    campaign_id VARCHAR(64) NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (campaign_id, user_id)
);

-- 8. CIRCLES & CIRCLE MEMBERS
CREATE TABLE IF NOT EXISTS circles (
    id VARCHAR(64) PRIMARY KEY,
    owner_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    description TEXT,
    cover_image TEXT,
    invite_code VARCHAR(32) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS circle_members (
    id VARCHAR(64) PRIMARY KEY,
    circle_id VARCHAR(64) NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(32) NOT NULL DEFAULT 'member', -- 'owner', 'admin', 'member'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(circle_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_circle_members_user ON circle_members(user_id);

-- 9. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(64) NOT NULL,
    title VARCHAR(160) NOT NULL,
    body TEXT NOT NULL,
    campaign_id VARCHAR(64) REFERENCES campaigns(id) ON DELETE SET NULL,
    read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifs_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifs_unread ON notifications(user_id, read);

-- 10. REPORTS
CREATE TABLE IF NOT EXISTS reports (
    id VARCHAR(64) PRIMARY KEY,
    campaign_id VARCHAR(64) NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    reporter_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    reason VARCHAR(120) NOT NULL,
    details TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'open', -- 'open', 'resolved', 'dismissed'
    action_taken VARCHAR(64),
    resolved_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);

-- 11. VERIFICATION CHECKS (AUDIT LOG)
CREATE TABLE IF NOT EXISTS verification_checks (
    id VARCHAR(64) PRIMARY KEY,
    campaign_id VARCHAR(64) NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    reviewer_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    checks JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. USER SESSIONS (FOR GOOGLE AUTH)
CREATE TABLE IF NOT EXISTS user_sessions (
    session_token VARCHAR(128) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);

-- 12b. EMAIL OTPs (PASSWORDLESS AUTH)
CREATE TABLE IF NOT EXISTS email_otps (
    id VARCHAR(64) PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    code_hash VARCHAR(255) NOT NULL,  -- bcrypt hash of the 6-digit code
    expires_at TIMESTAMPTZ NOT NULL,  -- 10-minute TTL
    used BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_otps_email ON email_otps(email);
CREATE INDEX IF NOT EXISTS idx_email_otps_expires ON email_otps(expires_at);

-- 13. ANALYTICS EVENTS
CREATE TABLE IF NOT EXISTS analytics_events (
    id VARCHAR(64) PRIMARY KEY,
    event VARCHAR(120) NOT NULL,
    user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    props JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_event ON analytics_events(event);
CREATE INDEX IF NOT EXISTS idx_analytics_user ON analytics_events(user_id);

-- 14. MEDIA UPLOADS
CREATE TABLE IF NOT EXISTS media (
    id VARCHAR(64) PRIMARY KEY,
    owner_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    content_type VARCHAR(100),
    kind VARCHAR(20) DEFAULT 'image',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_owner ON media(owner_id);

-- 15. BANK ACCOUNTS
CREATE TABLE IF NOT EXISTS bank_accounts (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    bank_name VARCHAR(120) NOT NULL,
    bank_code VARCHAR(30) NOT NULL,
    account_number VARCHAR(20) NOT NULL,
    account_name VARCHAR(160) NOT NULL,
    recipient_code VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bank_accounts_user ON bank_accounts(user_id);

-- 16. PAYOUTS & DISBURSEMENTS
CREATE TABLE IF NOT EXISTS payouts (
    id VARCHAR(64) PRIMARY KEY,
    campaign_id VARCHAR(64) NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount_kobo BIGINT NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'NGN',
    bank_name VARCHAR(120) NOT NULL,
    account_number VARCHAR(20) NOT NULL,
    account_name VARCHAR(160) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'SUCCESS',
    reference VARCHAR(120),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payouts_campaign ON payouts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_payouts_user ON payouts(user_id);

-- ---------- GoodCause Impact Commitment ----------

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

