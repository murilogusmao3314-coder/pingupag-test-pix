# Upsell 1 — R$ 39,90

A dedicated optional page is available at `/upsell1`. A direct visit without a valid, verified prior purchase shows the real design in **preview mode** but cannot generate a Pix.

## Offer

- 4 Monster-themed wristbands and 1 pair of Bluetooth earbuds with a themed case.
- Price: R$ 39,90 (`3990` integer cents) for the entire optional kit, with a separate Pix charge.
- The product photo is sourced from the user's original 1254×1254 image and served at 900×900 through `public/upsell-kit-hq.avif` (optimized, modern format) and `public/upsell-kit-hq.webp` (quality-78 browser fallback). The previous `public/upsell-kit.webp` file was an excessively compressed 4.5 KB thumbnail and is no longer referenced by the page. Both new files are served locally, with no third-party image host.
- The page does **not** claim Apple-certified AirPods, licensed collaboration, or official provenance without verification. Product provenance, technical specifications, warranty and fulfillment must be confirmed with the actual supplier before launch.
- Two independent buttons: accepting offers a new payment; declining leaves the earlier payment unchanged.

## Navigation and security

1. The original checkout continues to create its existing Pix as before.
2. The primary `usePixConfirmation` verifies the gateway's exact approved reference and amount before enabling the upsell. `usePendingPurchases` similarly recovers approved primary payments when the visitor returns.
3. Only a valid, signed original payment that has encrypted customer **and address** details can enable the upsell. A short-lived opaque signed token (no plain personal data) is carried through localStorage, and the page checks it again before showing the accept button.
4. `createUpsellPix` revalidates the original signed receipt, decrypts the original buyer and shipping data only on the server, and re-queries the provider for `approved`. It never trusts a browser-supplied amount or paid flag.
5. Once accepted, the server generates a new `QUIZ-...` payment with exact amount 3990 and its own signed status receipt marked `kind: "upsell"`. This marker prevents upsell-on-upsell redirects, while Meta/GTM Purchase and UTMify statuses still process the separate order.
6. The second Pix code is kept only in sessionStorage for up to 30 minutes, to avoid recreating the charge after a short refresh. The tracking capability stays within the existing 24-hour pending-Pix recovery.
7. Only actual gateway `approved` counts as payment. Decline/closing the optional page never charges automatically.

## Operational notes

- The original gateway secret `PINGUPAG_API_KEY` stays server-only. No new credentials are required for the PinguPag request.
- UTMify uses the existing `UTMIFY_API_TOKEN` environment credential (when configured). The second order is sent separately using product ID `kit-pulseiras-fones-tematicos` and the preserved seven official campaign fields.
- Browser-only recovery cannot guarantee status capture when visitors permanently leave. Reliable independent server-to-server webhooks, durable idempotent order storage, and proof of stock/fulfillment should be added before promising end-to-end reliability.
- The app currently uses best-effort front-end debouncing plus session-stored Pix to avoid repeated clicks/reloads. Only a durable backend order ledger can guarantee one upsell charge per original purchase across devices.
- Tests cover unauthorised/unapproved payments, signed amount and gateway reference, status recovery, preview constraints, order/customer/address reuse, and local image signature. Live payment and actual vendor behavior must be tested in a controlled environment.

Related code: `src/routes/upsell1.tsx`, `src/lib/upsell.functions.ts`, `src/components/monster/upsell-session.ts`, and `public/upsell-kit-hq.avif` / `public/upsell-kit-hq.webp`.
