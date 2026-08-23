# RevenueCat — integrated (2026-08-23)
Memory for interacting with the user's RevenueCat account via integration proxy later.

## Identifiers (from /setup response)
- rc_project_id: proj47715175
- apple_app_id: app51b9ba8ef2
- play_app_id: app21009cc6fb
- entitlement_lookup_key: pro
- offering_lookup_key: default
- Packages:
  - $rc_monthly -> prod6bfffa6694  ($9.99 / P1M, trial: none)
  - $rc_annual  -> prodc1aa7c2cb5  ($79.99 / P1Y, trial: none)
- Dashboard: https://app.revenuecat.com/projects/proj47715175

## Status check
curl -sS -H "$AUTH" "$INTEGRATION_PROXY_URL/internal/revenuecat/projects/0e57a2a5-17a7-4a41-8558-d5ed2de50c03/status"

## Update products (integration proxy ONLY — never call RevenueCat REST API)
- Upsert price/trial/add package:
  POST $INTEGRATION_PROXY_URL/internal/revenuecat/projects/0e57a2a5-17a7-4a41-8558-d5ed2de50c03/products
  body: {"products":[{"package":"$rc_monthly","price":14.99,"currency":"USD","period":"P1M","prices":[{"amount_micros":14990000,"currency":"USD"}]}]}
- Remove package: DELETE .../products/%24rc_monthly
- Recover keys/repopulate .env: re-run idempotent /setup.

## Going live (USER does these — needed only for real store purchases)
Store credentials + matching IAP products in App Store Connect / Google Play with the SAME
product IDs shown in the dashboard. Steps are in the FAQ section of the payments panel.

## App wiring
- SDK keys live in /app/frontend/.env (EXPO_PUBLIC_REVENUECAT_*). Do not blank them.
- Init at module scope in app/_layout.tsx; entitlement gate via useSubscription() (src/lib/revenuecat.tsx).
- Identity bound via Purchases.logIn(user.id) in src/context/auth.tsx.
