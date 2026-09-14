# Donation Ledger Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every successful Paystack donation reconcile cleanly to one campaign, preserve private donor identity, render the correct public identity and amount, and refresh the fundraising UI immediately.

**Architecture:** Keep Paystack as the source of payment truth and PostgreSQL as the GoodCause ledger. Normalize verified Paystack fields at the provider boundary, claim each successful donation exactly once before crediting it, preserve signed-in identity independently from public anonymity, and return the credited campaign snapshot to the client.

**Tech Stack:** FastAPI, asyncpg/PostgreSQL, Paystack REST/webhooks, Expo React Native, TanStack Query, pytest.

**Spec:** Approved in-chat design from 2026-09-13.

## Global Constraints

- Never credit a client-reported success; require Paystack verification or a signed Paystack webhook.
- Require status `success`, currency `NGN`, and an exact amount match.
- Public anonymity hides name and message, but retains private donor ownership and amount.
- Payment application must be idempotent under webhook and callback races.
- Preserve unrelated working-tree changes.

---

### Task 1: Donation identity and public presentation

**Files:**
- Modify: `backend/routes_donations.py`
- Test: `backend/tests/test_donation_accounting.py`

**Interfaces:**
- Consumes: authenticated optional user and `DonateIn.anonymous`
- Produces: donation rows with private `donor_id`, `donor_name`, `donor_email`; public serializer masks anonymous identity and message

- [ ] Write failing tests for named and anonymous public donation serialization.
- [ ] Run tests and confirm failures reflect missing privacy behavior.
- [ ] Implement private identity snapshots and a public serializer.
- [ ] Run tests and confirm they pass.

### Task 2: Paystack reconciliation data

**Files:**
- Modify: `backend/payments.py`
- Modify: `backend/routes_donations.py`
- Modify: `backend/schema.sql`
- Test: `backend/tests/test_donation_accounting.py`

**Interfaces:**
- Consumes: Paystack Verify or `charge.success` data
- Produces: normalized `provider_transaction_id`, `verified_amount_kobo`, `payment_channel`, `provider_fee_kobo`, and `provider_paid_at`

- [ ] Write failing normalization and exact-match tests.
- [ ] Run tests and confirm failures.
- [ ] Normalize and persist reconciliation fields.
- [ ] Add backward-compatible schema migration statements.
- [ ] Run tests and confirm they pass.

### Task 3: Idempotent accounting and response snapshot

**Files:**
- Modify: `backend/routes_donations.py`
- Modify: `backend/supabase_adapter.py`
- Test: `backend/tests/test_donation_accounting.py`

**Interfaces:**
- Consumes: a verified donation reference
- Produces: one claim winner, one campaign increment, and `prev_percent`, `new_percent`, `raised_kobo`, `campaign_id`

- [ ] Write failing tests for duplicate claims and credited response fields.
- [ ] Run tests and confirm failures.
- [ ] Add conditional-update result reporting and use it to gate campaign crediting.
- [ ] Return the credited campaign snapshot from verify.
- [ ] Run tests and confirm they pass.

### Task 4: Immediate fundraising UI refresh

**Files:**
- Modify: `frontend/app/donate/[id].tsx`
- Modify: `frontend/app/campaign/[id].tsx`

**Interfaces:**
- Consumes: verification response snapshot
- Produces: accurate success percentages and invalidated campaign/supporter/donation queries

- [ ] Update the live success state from backend percentages.
- [ ] Invalidate `campaign`, `supporters`, `impact`, and `myDonations` queries.
- [ ] Always render the donation amount alongside organizer thank-you controls.
- [ ] Run scoped ESLint.

### Task 5: Release verification

**Files:**
- Verify all files above

**Interfaces:**
- Consumes: completed backend and frontend changes
- Produces: evidence for tests, syntax, lint, and live configuration readiness

- [ ] Run focused pytest tests.
- [ ] Run Python compilation checks.
- [ ] Run scoped frontend ESLint.
- [ ] Inspect the final diff for unrelated changes.
- [ ] Report the required Paystack Dashboard webhook and controlled-transaction verification step.
