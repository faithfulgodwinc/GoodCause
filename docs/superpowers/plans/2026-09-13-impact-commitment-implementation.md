# GoodCause 80% Impact Commitment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build accurate membership messaging, an auditable monthly 80/20 settlement ledger, deterministic equal cause allocations, distribution tracking, and public transparency reports.

**Architecture:** Keep RevenueCat entitlement handling unchanged and treat authoritative Apple/Google settlement amounts as admin-confirmed ledger inputs. A pure allocation-policy module performs kobo-safe calculations; focused API routes persist state transitions and expose separate public and admin views. Native screens consume published data and use one shared copy module so purchase disclosures remain consistent.

**Tech Stack:** FastAPI, Pydantic, PostgreSQL/Supabase through the repository database adapter, Expo Router, React Native, TanStack Query, RevenueCat SDK, pytest, ESLint.

**Spec:** `docs/superpowers/specs/2026-09-13-impact-commitment-design.md`

## Global Constraints

- GoodCause commits 80% of confirmed net membership proceeds; the whole-kobo calculation is `floor(net_proceeds_kobo * 80 / 100)` and the operating portion receives the fractional-kobo remainder.
- Apple and Google process native subscription payments; RevenueCat manages entitlements and subscription data.
- Paystack direct donations remain separate from membership accounting.
- Only `LIVE`, `VERIFIED`, under-goal campaigns with verified payout details qualify.
- Approved and published financial history is append-only; later corrections use adjustment records.
- No fabricated membership, giving, cause, or outcome claims may appear.
- Required purchase disclosure must be readable and cannot rely on tiny, low-contrast, truncated, or hidden text.
- Public APIs never expose reconciliation references, store documents, payout details, or administrator identities.

---

## File Structure

- `backend/impact_policy.py`: pure 80/20 and capped equal-allocation calculations.
- `backend/impact_ledger.py`: atomic PostgreSQL state transitions and paid-allocation accounting.
- `backend/routes_impact.py`: public and administrator Impact Commitment endpoints.
- `backend/migrations/20260913_impact_commitment.sql`: additive ledger schema and indexes.
- `backend/schema.sql`: canonical schema parity.
- `backend/server.py`: route registration.
- `backend/tests/test_impact_policy.py`: pure financial invariants and edge cases.
- `backend/tests/test_impact_routes.py`: authorization, lifecycle, privacy, and response contracts.
- `frontend/src/constants/impact-commitment.ts`: canonical compact and expanded product copy.
- `frontend/src/types/index.ts`: public impact report types.
- `frontend/app/impact-commitment.tsx`: public/member transparency report.
- `frontend/app/admin/impact.tsx`: settlement entry, calculation, approval, payment, publication controls.
- `frontend/app/_layout.tsx`: register new screens.
- Existing membership, home, profile, donation, privacy, and public policy files: corrected copy and links.

---

### Task 1: Pure Financial Policy

**Files:**
- Create: `backend/impact_policy.py`
- Create: `backend/tests/test_impact_policy.py`

**Interfaces:**
- Produces: `split_net_proceeds(net_proceeds_kobo: int) -> tuple[int, int]`
- Produces: `allocate_equally(available_kobo: int, campaigns: list[dict]) -> dict`
- Campaign inputs contain `id`, `goal_kobo`, and `raised_kobo`.
- Allocation output contains `allocations: list[dict]`, `allocated_kobo`, and `rollover_kobo`.

- [ ] **Step 1: Write failing percentage and validation tests**

```python
from impact_policy import split_net_proceeds

def test_split_preserves_every_kobo():
    assert split_net_proceeds(101) == (80, 21)

def test_split_rejects_negative_proceeds():
    with pytest.raises(ValueError, match="non-negative"):
        split_net_proceeds(-1)
```

- [ ] **Step 2: Run the percentage tests and confirm RED**

Run: `cd backend && python -m pytest -o required_plugins= -o addopts= tests/test_impact_policy.py -q`

Expected: collection fails because `impact_policy` does not exist.

- [ ] **Step 3: Implement the minimal 80/20 split**

```python
def split_net_proceeds(net_proceeds_kobo: int) -> tuple[int, int]:
    if net_proceeds_kobo < 0:
        raise ValueError("Net proceeds must be non-negative")
    impact = net_proceeds_kobo * 80 // 100
    return impact, net_proceeds_kobo - impact
```

- [ ] **Step 4: Add failing allocation tests**

Cover equal division, deterministic one-kobo remainder, one nearly funded cause, repeated redistribution, no eligible campaigns, zero available funds, and input-order independence. Assert:

```python
result = allocate_equally(1_000, [
    {"id": "b", "goal_kobo": 10_000, "raised_kobo": 0},
    {"id": "a", "goal_kobo": 100, "raised_kobo": 0},
])
assert result == {
    "allocations": [
        {"campaign_id": "a", "amount_kobo": 100, "remaining_goal_snapshot_kobo": 100},
        {"campaign_id": "b", "amount_kobo": 900, "remaining_goal_snapshot_kobo": 10_000},
    ],
    "allocated_kobo": 1_000,
    "rollover_kobo": 0,
}
```

- [ ] **Step 5: Implement deterministic capped water-filling**

Sort by campaign ID, allocate the integer equal share, cap at remaining goal, distribute whole-kobo remainders in sorted order without crossing caps, repeat while capacity remains, and return unallocated kobo as rollover.

- [ ] **Step 6: Run policy tests and commit**

Run: `cd backend && python -m pytest -o required_plugins= -o addopts= tests/test_impact_policy.py -q`

Expected: all tests pass.

Commit: `git commit -m "Add impact allocation policy"`

---

### Task 2: Additive Impact Ledger Schema

**Files:**
- Create: `backend/migrations/20260913_impact_commitment.sql`
- Modify: `backend/schema.sql`
- Create: `backend/tests/test_impact_schema.py`

**Interfaces:**
- Produces tables `impact_periods`, `impact_allocations`, and `impact_adjustments` with names and states defined in the spec.
- `impact_periods.period_key` and `(impact_allocations.period_id, campaign_id)` are unique.
- Non-null `impact_allocations.payment_reference` values are unique through a partial unique index.

- [ ] **Step 1: Write a failing migration contract test**

Read the migration and assert it contains all three `CREATE TABLE IF NOT EXISTS` statements, lifecycle status checks, foreign keys, non-negative money checks, uniqueness constraints, and indexes.

- [ ] **Step 2: Run the schema test and confirm RED**

Run: `cd backend && python -m pytest -o required_plugins= -o addopts= tests/test_impact_schema.py -q`

- [ ] **Step 3: Write the additive transaction-safe migration**

Use `BEGIN`/`COMMIT`, `BIGINT` kobo fields, `TIMESTAMPTZ`, campaign/user foreign keys, and database checks for valid period/allocation states and non-negative stored totals. Store adjustment amounts as signed `BIGINT`.

- [ ] **Step 4: Mirror the exact table definitions in `schema.sql`**

Do not alter existing donation, campaign, RevenueCat, or payout columns.

- [ ] **Step 5: Run schema tests and commit**

Run: `cd backend && python -m pytest -o required_plugins= -o addopts= tests/test_impact_schema.py -q`

Expected: all tests pass.

Commit: `git commit -m "Add impact commitment ledger schema"`

---

### Task 3: Admin Lifecycle and Atomic Distribution Accounting

**Files:**
- Create: `backend/impact_ledger.py`
- Create: `backend/routes_impact.py`
- Modify: `backend/server.py`
- Create: `backend/tests/test_impact_routes.py`

**Interfaces:**
- Consumes: `split_net_proceeds` and `allocate_equally` from `impact_policy.py`.
- Produces admin endpoints under `/api/admin/impact-periods`.
- Produces `apply_impact_payment(allocation_id: str, payment_reference: str) -> dict | None`.

- [ ] **Step 1: Write failing authorization and draft tests**

Test that non-admin users receive 403. Test creation of one unique `DRAFT` period and validation that Apple, Google, and adjustment inputs produce:

```json
{
  "net_proceeds_kobo": 100000,
  "current_impact_kobo": 80000,
  "operating_kobo": 20000
}
```

- [ ] **Step 2: Implement draft creation and settlement updates**

Use Pydantic models with non-negative Apple/Google values. Accept signed adjustments only with a non-empty explanation. Recalculate net proceeds and reject a resulting negative total.

- [ ] **Step 3: Write failing calculation tests**

Test that calculation selects only qualifying campaigns, snapshots title and remaining goal, includes the previous closed period's rollover, balances all totals, and transitions `DRAFT -> CALCULATED`. Repeated calculation in another state must return 409.

- [ ] **Step 4: Implement calculation persistence in one database transaction**

Lock the period, fetch eligible campaigns using `status='LIVE'`, `verification_status='VERIFIED'`, remaining goal, and verified payout-bank criteria, call the pure policy, insert allocation rows, update balanced totals, and commit once.

- [ ] **Step 5: Write failing approval/publication/closure tests**

Assert only `CALCULATED -> APPROVED -> PUBLISHED -> CLOSED` is allowed, approval freezes inputs, publication requires approval, and closure requires every allocation to be `PAID` or `CANCELLED` with cancellation value represented in closing rollover/adjustments.

- [ ] **Step 6: Implement guarded state transitions**

Each update includes the expected current state in its SQL predicate. Return 409 when no row transitions. Store actor and transition timestamps.

- [ ] **Step 7: Write failing idempotent payment tests**

Assert the first application sets the allocation to `PAID`, records a unique reference, increases campaign `raised_kobo`, and returns `already=False`. A repeated request returns `already=True` without changing the campaign twice. Reject an amount that would exceed the recorded allocation or campaign cap.

- [ ] **Step 8: Implement atomic payment application**

Use a single PostgreSQL CTE that claims only an `ALLOCATED` row, marks it `PAID`, and credits the campaign once. Do not route the record through the Paystack donations table.

- [ ] **Step 9: Run focused backend tests and commit**

Run: `cd backend && python -m pytest -o required_plugins= -o addopts= tests/test_impact_policy.py tests/test_impact_schema.py tests/test_impact_routes.py -q`

Expected: all tests pass.

Commit: `git commit -m "Add impact period administration"`

---

### Task 4: Public Transparency API

**Files:**
- Modify: `backend/routes_impact.py`
- Modify: `backend/tests/test_impact_routes.py`

**Interfaces:**
- Produces `GET /api/impact/latest`.
- Produces `GET /api/impact/periods?limit=&offset=`.
- Produces `GET /api/impact/periods/{period_key}`.

- [ ] **Step 1: Write failing empty/public/privacy tests**

Assert latest returns `{"status": "pending", "report": null}` before first publication. Assert historical endpoints return only `PUBLISHED` or `CLOSED` periods and never include `reconciliation_reference`, `created_by`, `approved_by`, bank details, or financial documents.

- [ ] **Step 2: Write failing response-shape tests**

Published output includes period key, publication timestamp, confirmed net proceeds, current impact, opening rollover, available impact, paid/pending/cancelled totals, closing rollover, and campaign allocation snapshots with campaign ID, title, amount, and status.

- [ ] **Step 3: Implement safe serializers and public queries**

Build explicit allow-list serializers rather than returning database rows. Paginate history with bounded `limit` from 1 to 24.

- [ ] **Step 4: Run route tests and commit**

Run: `cd backend && python -m pytest -o required_plugins= -o addopts= tests/test_impact_routes.py -q`

Expected: all tests pass.

Commit: `git commit -m "Expose public impact reports"`

---

### Task 5: Accurate Membership Copy and Purchase Disclosures

**Files:**
- Create: `frontend/src/constants/impact-commitment.ts`
- Modify: `frontend/app/onboarding/commitment.tsx`
- Modify: `frontend/app/onboarding/model.tsx`
- Modify: `frontend/app/onboarding/payment.tsx`
- Modify: `frontend/app/onboarding/success.tsx`
- Modify: `frontend/app/paywall.tsx`
- Modify: `frontend/app/donate/[id].tsx`
- Create: `backend/tests/test_impact_copy_contract.py`

**Interfaces:**
- Produces `IMPACT_PERCENT = 80`.
- Produces `IMPACT_DISCLOSURE_COMPACT` and `DIRECT_DONATION_DISCLOSURE`.

- [ ] **Step 1: Write failing canonical-copy tests**

Import the repository root with `Path(__file__).resolve().parents[2]`. Assert the constants source contains `80%`, `net proceeds`, and `Store deductions, refunds and adjustments apply`. Assert direct donation copy contains `one-time`, `this campaign`, and `separate from GoodCause Membership`.

- [ ] **Step 2: Create the canonical copy module**

Export exact strings from the approved specification. Do not duplicate financial wording across screens.

- [ ] **Step 3: Replace misleading onboarding language**

Rename pledge/giving language to membership language. Remove `IMPACT_MAP`, the full-price “first contribution,” “Community Fund,” “doesn't just sit in a bank,” and specific unsupported medical or meal outcomes.

- [ ] **Step 4: Add compact disclosure to both purchase paths**

Place the shared disclosure immediately above the action in onboarding payment and the Pro paywall, using at least the existing caption size and sufficient contrast. Add `Learn how it works` navigation to `/impact-commitment`. Repeat it in the paywall confirmation modal.

- [ ] **Step 5: Correct success and direct-donation copy**

Confirm membership activation using the approved language. Add the separate Paystack direct-donation disclosure near its payment action.

- [ ] **Step 6: Run tests and scoped lint, then commit**

Run: `cd backend && python -m pytest -o required_plugins= -o addopts= tests/test_impact_copy_contract.py -q`

Run: `cd frontend && .\node_modules\.bin\eslint.cmd "app/onboarding/*.tsx" "app/paywall.tsx" "app/donate/[id].tsx" "src/constants/impact-commitment.ts"`

Expected: tests pass and lint has zero new errors.

Commit: `git commit -m "Clarify membership impact commitment"`

---

### Task 6: Transparency, Home, Profile, and Admin Screens

**Files:**
- Create: `frontend/app/impact-commitment.tsx`
- Create: `frontend/app/admin/impact.tsx`
- Modify: `frontend/app/admin/index.tsx`
- Modify: `frontend/app/(tabs)/index.tsx`
- Modify: `frontend/app/(tabs)/profile.tsx`
- Modify: `frontend/app/_layout.tsx`
- Modify: `frontend/src/types/index.ts`
- Modify: `backend/routes_campaigns.py`
- Modify: `backend/tests/test_impact_copy_contract.py`

**Interfaces:**
- Consumes public and admin API contracts from Tasks 3 and 4.
- Produces member-visible report navigation and admin lifecycle controls.

- [ ] **Step 1: Write failing trust-presentation tests**

Read the relevant frontend and backend source files from the repository-level pytest contract. Assert they no longer contain `1284`, `840000000`, `2,400+`, or fallback labels `₦8.4M` and `1,284`; verify the former `145` floor expression is absent without banning legitimate unrelated uses of the number. Assert the transparency screen contains `First report pending` and calls `/impact/latest`.

- [ ] **Step 2: Remove backend and frontend fabricated fallbacks**

Return actual database metrics from `/api/home`; render verified zero/empty states rather than minimum claims. Rename “Given this month” if it combines direct donations with other totals; do not present it as membership impact.

- [ ] **Step 3: Add public report types and transparency screen**

Create exact TypeScript types matching the safe serializers. Use TanStack Query for latest/history. Render the 80% explanation, balances, status-labelled allocations, publication time, direct-donation distinction, and pending empty state.

- [ ] **Step 4: Update home and profile navigation**

Home shows membership status and latest confirmed report without attributing a personal donation amount. Profile adds `My membership` and `Impact Commitment` entries.

- [ ] **Step 5: Add admin period workflow**

Provide fields for Apple proceeds, Google proceeds, signed adjustments with explanations, and reconciliation reference. Provide state-aware calculate, approve, publish, record-payment, cancel-with-adjustment, and close actions with destructive-action confirmations.

- [ ] **Step 6: Register routes and run scoped checks**

Run frontend copy tests and ESLint on all changed files. Run backend home and impact route tests.

- [ ] **Step 7: Commit**

Commit: `git commit -m "Add impact transparency reporting"`

---

### Task 7: Terms, Privacy, Migration, and Production Verification

**Files:**
- Modify: `frontend/app/privacy.tsx`
- Modify: `frontend/public/privacy.html`
- Create: `frontend/public/terms.html`
- Modify: `frontend/app/auth/index.tsx`
- Modify: `backend/tests/test_impact_routes.py`

**Interfaces:**
- Consumes all prior tasks.
- Produces consistent legal/product wording and production-ready schema.

- [ ] **Step 1: Add a failing consistency test**

Extend `backend/tests/test_impact_copy_contract.py` to assert in-app privacy/terms, `frontend/public/privacy.html`, and `frontend/public/terms.html` contain the membership/direct-donation distinction, 80% of confirmed net proceeds, 20% operations, rollover treatment, store renewal/cancellation, and no tax-deductibility promise.

- [ ] **Step 2: Update in-app and public policies**

Use the exact definitions from the specification and update effective dates. Correct the existing statement that RevenueCat processes payments. Make the auth screen's Terms link open `/terms.html` on web and the in-app Terms tab on native; keep Privacy linked to the existing policy destination.

- [ ] **Step 3: Run complete scoped verification**

Run:

```powershell
cd backend
python -m pytest -o required_plugins= -o addopts= tests/test_impact_policy.py tests/test_impact_schema.py tests/test_impact_routes.py tests/test_donation_accounting.py -q
python -m py_compile impact_policy.py impact_ledger.py routes_impact.py server.py
cd ..\frontend
.\node_modules\.bin\eslint.cmd "app/impact-commitment.tsx" "app/admin/impact.tsx" "app/onboarding/*.tsx" "app/paywall.tsx" "app/donate/[id].tsx" "app/(tabs)/index.tsx" "app/(tabs)/profile.tsx" "app/privacy.tsx"
cd ..
git diff --check
```

Expected: focused backend tests pass, Python compiles, frontend tests pass, ESLint has zero new errors, and diff check is clean.

- [ ] **Step 4: Apply the additive production migration**

Run: `python backend/apply_migration.py backend/migrations/20260913_impact_commitment.sql`

Expected: migration commits successfully without modifying existing data.

- [ ] **Step 5: Perform non-monetary live checks after deployment**

Verify `/api/impact/latest` returns the pending or published safe contract, `/api/home` contains no fabricated floors, admin endpoints reject non-admin callers, and existing `/api/config` remains in the intended Paystack mode. Do not simulate store proceeds, create a published financial report, or move money without real settlement evidence.

- [ ] **Step 6: Commit the final policy alignment**

Commit: `git commit -m "Align impact commitment policies"`

- [ ] **Step 7: Push only after verification and report operational handoff**

The handoff must state that the first report remains pending until an administrator enters authoritative Apple/Google settlement figures and completes actual distributions.
