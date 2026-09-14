# GoodCause 80% Impact Commitment Design

**Date:** 2026-09-13

**Status:** Approved in chat; awaiting written-spec review

**Scope:** Membership messaging, settlement accounting, cause allocation, distribution tracking, and public transparency

## Purpose

GoodCause sells an auto-renewing membership through Apple App Store and Google Play subscriptions managed by RevenueCat. Membership provides ongoing GoodCause product benefits. Separately, GoodCause commits 80% of the net membership proceeds it actually receives to verified active causes.

This design replaces language that presents membership as a direct donation or promises that the subscriber's full purchase price reaches causes. Direct campaign donations processed through Paystack remain a separate payment flow.

## Financial Definitions

- **Gross store sales:** Customer prices reported by Apple and Google before deductions.
- **Net membership proceeds:** Cash attributable to membership that GoodCause confirms from authoritative Apple and Google settlement reports, after store commissions, taxes, refunds, chargebacks, currency conversion, and other payment adjustments.
- **Impact allocation:** The whole-kobo result of 80% of net membership proceeds for a closed allocation period, plus any restricted rollover entering that period.
- **Operating portion:** Net membership proceeds minus the whole-kobo impact allocation, retained by GoodCause for platform development, verification, security, support, and operations.
- **Restricted rollover:** Impact allocation that could not be assigned without exceeding eligible campaign targets. It remains available only for future impact allocations and is not operating revenue.
- **Direct donation:** A Paystack payment intentionally designated by a donor for one campaign. It is not membership revenue and never participates in the monthly allocation calculation.

All calculations use integer kobo. Each period must satisfy:

`current impact = floor(net proceeds × 80 ÷ 100)`

`operating portion = net proceeds − current impact`

and:

`available impact = 80% of net proceeds + opening rollover`

`available impact = allocations issued + closing rollover`

The operating portion absorbs any fractional-kobo percentage remainder because currency cannot represent a fraction of one kobo. Equal-allocation division places any remaining whole kobo into closing rollover so no kobo disappears.

## Source of Truth

RevenueCat remains the source of subscription entitlement state and useful estimated revenue events. It is not the accounting source for the final 80% commitment.

An administrator records the authoritative Apple and Google settlement amounts for each period, along with a non-public reconciliation reference. The backend calculates the allocation only from confirmed amounts. Future store-report imports may automate entry but must write into the same settlement ledger and pass the same validation.

## Monthly Lifecycle

An impact period moves through these states:

1. `DRAFT`: settlement figures may be entered and corrected.
2. `CALCULATED`: the backend freezes the eligible-campaign snapshot and proposed allocations.
3. `APPROVED`: allocations are authorized; financial inputs and allocation rows become immutable.
4. `PUBLISHED`: the public report is visible.
5. `CLOSED`: every allocation is paid, cancelled through an adjustment, or returned to rollover.

Only administrators may move periods forward. State transitions are one-way. Errors after approval are corrected with explicit adjustment records; published records are never silently rewritten.

## Campaign Eligibility

A campaign is eligible at calculation time only when all of the following are true:

- its status is `LIVE`;
- its `verification_status` is `VERIFIED`;
- its goal is greater than its raised amount;
- it is not suspended, rejected, expired, or deleted;
- its saved payout bank is marked verified under the platform's existing payout controls.

Eligibility is snapshotted when the period is calculated. If a campaign later becomes unsafe or invalid before payment, its allocation is not reassigned silently. An administrator records a cancellation adjustment, and that amount becomes restricted rollover for a future period.

## Equal Allocation Algorithm

The backend allocates the available impact amount equally using a capped water-filling algorithm:

1. Sort eligible campaigns by stable campaign ID for deterministic rounding.
2. Divide the remaining amount equally among remaining campaigns.
3. Cap each campaign at its remaining goal.
4. Remove capped campaigns and divide the excess among the campaigns still able to receive funds.
5. Continue until all money is allocated or every campaign is capped.
6. Put any unallocatable or indivisible remainder into closing rollover.

The algorithm must be deterministic, preserve every kobo, never produce a negative amount, and never push a campaign above its goal based on the calculation snapshot.

Impact allocations do not update a campaign's public `raised_kobo` value merely because they were calculated or approved. The campaign total changes only when the allocation is marked paid through the same idempotent accounting principles used for direct donations.

## Data Model

### `impact_periods`

- `id`
- `period_key` (unique calendar or store-accounting period)
- `status`
- `apple_net_kobo`
- `google_net_kobo`
- `adjustments_kobo`
- `net_proceeds_kobo`
- `current_impact_kobo`
- `operating_kobo`
- `opening_rollover_kobo`
- `available_impact_kobo`
- `allocated_kobo`
- `closing_rollover_kobo`
- `reconciliation_reference` (admin-only)
- `calculated_at`, `approved_at`, `published_at`, `closed_at`
- `created_by`, `approved_by`
- timestamps

### `impact_allocations`

- `id`
- `period_id`
- `campaign_id`
- `campaign_title_snapshot`
- `remaining_goal_snapshot_kobo`
- `amount_kobo`
- `status` (`ALLOCATED`, `PAID`, `CANCELLED`)
- `payment_reference`
- `paid_at`
- timestamps

The `(period_id, campaign_id)` pair and non-null payment references are unique. Payment application is atomic and idempotent.

### `impact_adjustments`

- `id`
- `period_id`
- `allocation_id` when applicable
- signed `amount_kobo`
- reason code and explanation
- creator and timestamp

Adjustments provide an append-only correction trail.

## API Boundaries

Public endpoints expose only published periods and safe allocation fields:

- latest published Impact Commitment summary;
- paginated historical reports;
- one published period with campaign allocations.

Authenticated members receive the same financial totals plus their membership status. The UI must not claim an individualized donation amount because store settlements cannot be reliably attributed to a specific subscriber.

Admin endpoints support creating a period, entering confirmed settlement figures, calculating allocations, approving, recording allocation payments, publishing, closing, and appending adjustments. Every mutation validates the current state and administrator role.

No public response exposes reconciliation references, admin identities, payout information, or store financial documents.

## Screen and Copy Design

### Commitment selection

Replace donation language with membership language:

- Title: **Choose your GoodCause membership**
- Supporting text: **Get member benefits and help GoodCause fund verified causes every month.**
- Compact trust line: **GoodCause commits 80% of net membership proceeds to verified causes.**

### Membership explanation

Remove outcome claims such as a tier providing a specific medicine or meal unless backed by campaign data. Explain that membership supports both the product and the Impact Commitment.

### Purchase confirmation and paywall

Immediately before the purchase action, display readable compact disclosure:

> 80% of net proceeds received by GoodCause supports verified causes. Store deductions, refunds and adjustments apply.

Provide a **Learn how it works** link to the full Impact Commitment screen. The confirmation modal repeats the compact disclosure. Legal meaning must not depend on extremely small, low-contrast, truncated, or hidden text.

The paywall continues to list substantive ongoing membership features to satisfy the nature of an auto-renewing app subscription.

### Success screen

Confirm membership activation without claiming the full purchase price was donated:

> Your membership is active. You're supporting the tools behind GoodCause, and 80% of net membership proceeds is committed to verified causes.

### Home and profile

The home commitment card shows active membership and links to the latest published report. Profile adds **My membership** and **Impact Commitment** access. It does not describe the store price as the member's personal charitable contribution.

### Impact Commitment screen

The screen contains:

- the 80% promise and definition of net proceeds;
- the latest published period;
- confirmed net proceeds;
- current 80% allocation;
- opening and closing rollover;
- distributed and pending totals;
- funded causes and their allocation statuses;
- historical published reports;
- an explanation separating membership from Paystack direct donations.

If no report exists, show **First report pending**. Never substitute fabricated data.

### Direct donation

Near the Paystack action, display:

> This one-time donation is designated for this campaign and is separate from GoodCause Membership.

## Trust and Accuracy Requirements

- Remove hard-coded minimum claims of 1,284 members, ₦8.4M given, 145 causes helped, and 2,400+ Pro members.
- Show zero, an empty state, or omit a metric when verified data is unavailable.
- Label whether a number is confirmed, allocated, paid, pending, or rolled over.
- Never call RevenueCat the payment processor; Apple and Google process native subscription payments while RevenueCat manages entitlements and subscription data.
- Keep membership accounting and Paystack donation accounting separate.
- Publish a timestamp and immutable period identifier on every report.
- Keep non-public reconciliation evidence for audit and later independent review.

## Legal and Policy Copy

The in-app Terms, in-app privacy disclosure, and public web policy must consistently state:

- membership is a purchase of ongoing GoodCause benefits, not a direct charitable donation;
- Apple or Google processes native subscription payments and RevenueCat manages entitlements;
- GoodCause commits 80% of confirmed net membership proceeds to eligible causes;
- GoodCause retains 20% for operations;
- allocations follow the published eligibility and rollover rules;
- direct Paystack donations are separate and campaign-designated;
- subscriptions renew and can be cancelled through store settings.

The effective date is updated when the new terms ship. Product copy must not promise tax deductibility.

## Failure Handling

- Settlement figures cannot be negative unless represented through a documented adjustment.
- A period cannot calculate without confirmed settlement inputs.
- A period cannot approve without balanced ledger equations.
- An allocation cannot be paid twice or paid above its recorded amount.
- If no campaigns qualify, the full available impact amount becomes closing rollover.
- If a payout fails, the allocation remains pending and public status reflects that fact.
- Refunds or chargebacks discovered after approval are represented in a later period adjustment rather than rewriting history.

## Testing

Backend tests cover percentage calculation, kobo rounding, zero eligible campaigns, campaigns near their goals, deterministic equal allocation, rollover, state-transition authorization, immutable approval, adjustment audit trails, and idempotent payment application.

Frontend tests cover required compact disclosure at both purchase paths, the Learn link, pending-report empty state, published report rendering, membership/direct-donation separation, and removal of fabricated metrics and unsupported outcome claims.

Migration tests confirm additive schema changes and compatibility with existing campaigns, donations, payouts, and RevenueCat entitlement behavior.

## Rollout

1. Ship accurate copy and remove unsupported statistics.
2. Apply the additive impact-ledger migration.
3. Enable admin settlement entry and allocation calculation.
4. Publish the Impact Commitment screen with **First report pending**.
5. Enter and reconcile the first authoritative store settlement.
6. Approve, distribute, and publish the first monthly report.
7. Add automated Apple/Google report imports later without changing ledger semantics.

Until the first confirmed report is published, GoodCause must not show estimated subscription distributions as completed impact.
