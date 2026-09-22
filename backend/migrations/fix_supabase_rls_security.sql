-- ====================================================================
-- GoodCause Supabase RLS Security Hardening
-- Resolves Supabase Security Alerts:
--   1. rls_disabled_in_public (Row-Level Security not enabled)
--   2. sensitive_columns_exposed (Sensitive user/session/bank data public)
-- ====================================================================

-- 1. USERS & AUTH (Sensitive)
ALTER TABLE IF EXISTS users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS email_otps ENABLE ROW LEVEL SECURITY;

-- 2. FINANCIAL & BANKING (Sensitive)
ALTER TABLE IF EXISTS bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS payouts ENABLE ROW LEVEL SECURITY;

-- 3. AUDIT, REPORTS & CHECKS (Sensitive)
ALTER TABLE IF EXISTS reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS verification_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS analytics_events ENABLE ROW LEVEL SECURITY;

-- 4. CAMPAIGNS & CONTENT
ALTER TABLE IF EXISTS categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS campaign_budget_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS campaign_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS campaign_followers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS saved_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS media ENABLE ROW LEVEL SECURITY;

-- 5. CIRCLES
ALTER TABLE IF EXISTS circles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS circle_members ENABLE ROW LEVEL SECURITY;

-- 6. IMPACT COMMITMENT
ALTER TABLE IF EXISTS impact_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS impact_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS impact_adjustments ENABLE ROW LEVEL SECURITY;

-- ====================================================================
-- ROW LEVEL SECURITY POLICIES (PostgREST / Supabase Client Access)
-- Note: Direct backend connection via postgres connection string
-- automatically BYPASSES RLS. These policies strictly govern
-- public access via Supabase REST API / Anon Key.
-- ====================================================================

-- Categories: Publicly readable
DROP POLICY IF EXISTS "Public categories read" ON categories;
CREATE POLICY "Public categories read" ON categories
    FOR SELECT USING (true);

-- Campaigns: Publicly readable if LIVE or COMPLETED
DROP POLICY IF EXISTS "Public campaigns read" ON campaigns;
CREATE POLICY "Public campaigns read" ON campaigns
    FOR SELECT USING (status IN ('LIVE', 'COMPLETED'));

-- Campaign Updates: Publicly readable
DROP POLICY IF EXISTS "Public updates read" ON campaign_updates;
CREATE POLICY "Public updates read" ON campaign_updates
    FOR SELECT USING (true);

-- Campaign Budget Items: Publicly readable
DROP POLICY IF EXISTS "Public budget items read" ON campaign_budget_items;
CREATE POLICY "Public budget items read" ON campaign_budget_items
    FOR SELECT USING (true);

-- Impact Periods: Publicly readable if PUBLISHED or CLOSED
DROP POLICY IF EXISTS "Public impact periods read" ON impact_periods;
CREATE POLICY "Public impact periods read" ON impact_periods
    FOR SELECT USING (status IN ('PUBLISHED', 'CLOSED'));

-- Impact Allocations: Publicly readable
DROP POLICY IF EXISTS "Public impact allocations read" ON impact_allocations;
CREATE POLICY "Public impact allocations read" ON impact_allocations
    FOR SELECT USING (true);

-- Impact Adjustments: Publicly readable
DROP POLICY IF EXISTS "Public impact adjustments read" ON impact_adjustments;
CREATE POLICY "Public impact adjustments read" ON impact_adjustments
    FOR SELECT USING (true);
