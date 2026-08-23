# GoodCause — Product Requirements Document

## Original Problem Statement
Build **GoodCause**, a trusted community DONATION-based fundraising mobile app launching in Nigeria (NGN, en-NG), architected for future multi-country/global expansion. Tagline: **"Trust makes generosity go further."** Inspired by GoFundMe's use case but a distinct product/identity (comparison used only in internal docs). Strictly donation/reward-based — NOT investment/equity/lending; no financial returns; no fake payments; no fake verification.

## Architecture (as built)
- **Frontend:** Expo (React Native) + expo-router, react-query, RevenueCat, custom design system (Fraunces + Plus Jakarta Sans, warm terracotta/sand palette — no blue/indigo).
- **Backend:** FastAPI (modular routers) with a clean data-access layer.
- **Database:** MongoDB (clean data layer). NOTE: user requested Supabase/PostgreSQL; the full Supabase SQL schema + RLS is documented and ready — the app can be migrated once the user provides a real Supabase connection string (they pasted a placeholder). The mobile app talks ONLY to FastAPI (`/api`); authorization enforced server-side.
- **Auth:** JWT email/password + Emergent-managed Google OAuth session. Tokens in expo-secure-store.
- **Payments:** `PaymentProvider` abstraction (payments.py) — real Paystack (init + webhook signature verify + server-side verify, kobo amounts, idempotent) + a clearly-labelled SANDBOX provider (server-side `sandbox-complete`, recorded `test=true`, no fake production success). Switches to live automatically when `PAYSTACK_SECRET_KEY` is set.
- **AI:** Gemini 3 Flash (`gemini-3-flash-preview`) via emergentintegrations universal key — supportive Campaign Assistant only (never approves/rejects/diagnoses).
- **Monetization:** RevenueCat "GoodCause Pro" (entitlement `pro`, `$rc_monthly`/`$rc_annual`). Provisioned via integration proxy. Details in `/app/memory/revenuecat.md`.

## User Personas
- **Donor:** browse/search/filter, view trust, donate (public/anonymous + message), follow/save, impact, share.
- **Fundraiser:** guided 9-step builder, beneficiary + budget + verification, submit, post updates, analytics, share, manage supporters.
- **Beneficiary:** identified on campaigns with declared relationship.
- **Admin:** review/verify/publish/reject/suspend campaigns, handle reports, view users/transactions, stats.

## Core Requirements (static)
CREATE → VERIFY → PUBLISH → SHARE → DONATE → UPDATE → IMPACT. Trust profile (completed checks, not a guarantee). Campaign states DRAFT/SUBMITTED/UNDER_REVIEW/VERIFIED/LIVE/PAUSED/COMPLETED/REJECTED/SUSPENDED. Verification states PENDING/IN_REVIEW/VERIFIED/REQUIRES_MORE_INFORMATION/REJECTED. Milestones 25/50/75/90/100. Human error messages. Thoughtful empty states. NGN/kobo money. Never store card data; secrets in env.

## Implemented (2026-08-23)- P0: Auth (JWT + Google), Home feed (6 sections), Explore (search + category chip row), Campaign detail (hero, organizer, progress, beneficiary, story, budget, Trust card, updates, supporters, share modal w/ QR, report), Donation sandbox flow (presets/custom/anonymous/message → success w/ prev→new% + impact card), Campaign updates, Sharing, Notifications + milestones, Transaction ledger, RevenueCat Pro paywall (restore/handle-unavailable), Admin moderation (verify/publish/reject/suspend/reports/transactions/stats), server-side authorization.
- P1: GoodCause Circles (create/join/detail/community totals), Impact dashboard (Profile), AI Campaign Assistant (in builder), Milestone detection + notifications, QR share card.
- Seed: 8 categories, admin + 3 organizers, 9 LIVE campaigns + 1 SUBMITTED (admin demo), real seeded donations (raised totals are true aggregates), sample updates.
- Testing: 26/26 backend pytest passing; frontend core flows verified. No critical bugs.

## Backlog / Remaining
- **P1:** Real media upload (currently curated cover picker) via Emergent Object Storage or Supabase Storage; scheduled updates; advanced Pro analytics screens.
- **P2:** Supabase/PostgreSQL migration (schema+RLS ready) once connection string provided; advanced AI risk signals; multi-country/currency; advanced donor segmentation; deeper community features.
- **Go-live:** Add Paystack test/live keys (env: PAYSTACK_SECRET_KEY etc.) to enable real donations + configure webhook URL; RevenueCat store-side products for real purchases (FAQ in payments panel).
- **Polish:** migrate RN `shadow*`→`boxShadow` (web warning); FastAPI startup→lifespan; tighten CORS before prod.

## Next Tasks
Enable live payments (Paystack keys), add real image upload, then optional Supabase migration.

## Iteration 2 (2026-08-23)- **Real media uploads:** Emergent Object Storage (backend `storage.py` + `routes_media.py`: POST /api/upload multipart, public GET /api/files/{path}). Client `MediaUploader` (expo-image-picker, images + video ≤60s, contextual permission handling per contract). Builder media step uploads real photos/video (cover auto-set to first image); campaign detail shows a Photos & video gallery. Verified: upload 200 + serve 200.
- **Thank-You Moments:** on completed donation, donor receives a warm `donation_thankyou` notification (with new campaign %) in Activity, alongside the personal impact/share card on the success screen. Verified via API.

## Iteration 3 (2026-08-23) — Design system + compress + Supabase prep
- **Full visual redesign** to match user's attached spec: Deep green primary (#16A34A), success green (#22C55E), warm gold accent (#FBBF24), clean white/#F9FAFB surfaces, **Inter** typography, rounded soft UI + subtle shadows. Centralized in `src/theme.ts` so it propagates across all screens/components. Dark surfaces recolored to premium dark-green (#0F1F17). Donate screen now a 6-preset 3-col grid.
- **Image auto-compress:** `MediaUploader` resizes to max width 1400 + JPEG compress 0.6 (expo-image-manipulator) before upload. Videos passed through.
- **Supabase:** connection VERIFIED via IPv4 pooler `aws-0-eu-central-1.pooler.supabase.com:6543` (user `postgres.rbxoajdceezxcyqfbylj`, Postgres 17.6). Direct `db.<ref>:5432` is IPv6-only (unreachable). Saved as `SUPABASE_DB_URL` in backend/.env. NEXT: migrate data layer (motor → asyncpg/SQL) as a dedicated task.

## Iteration 4 (2026-08-23) — Core-screen polish + Payment step + Video cover
- Polished the 5 signature screens (Home, Campaign Detail, Donation Amount, Payment, Success) to a premium consumer-app bar per the user's UI master prompt: time-based greeting + "Where would you like to make a difference today?", 6-amount donation grid, dedicated **Payment method screen** (Card/Bank/Mobile Money, secure note, "Support with ₦X" CTA), emotional success ("You just moved this cause forward." / "Thank you for showing up." + prev→new% + Share/View/Done), and Trust card reworded to **GoodCause Checks** with "How verification works →".
- **Campaign video cover:** optional `hero_video` (backend field + builder auto-captures first uploaded video); Campaign Detail autoplays it muted+looping via expo-video, falling back to the cover image.
- **PENDING (next dedicated pass):** full Supabase/PostgreSQL data-layer migration (motor→asyncpg, relational schema + RLS). Connection saved & verified (pooler).
