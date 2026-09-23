# Stripe payments: courses and Premium

New paid-course purchases, cart orders and Premium periods use Stripe hosted Checkout in `mode: payment`. Premium costs ฿99/month or ฿999/year. Each purchase is a one-time payment; there are no recurring Stripe subscriptions or automatic renewals. Eligible payment methods are selected by Stripe from the account's enabled methods, rather than hard-coded to cards.

## Purchase and fulfillment

- Buy Now and cart checkout snapshot course names/prices and preserve the EDUNova order reference. Amounts are summed in satang. Free enrollment requires no Stripe session; free items in mixed carts enroll immediately.
- Premium checkout snapshots the selected period and server price. Existing pending Stripe orders resume instead of creating another order. Historical manual orders are not reused or rewritten.
- `/checkout` renders `StripeCheckout`. Students review their order and explicitly continue to Stripe. Canceling returns to a retryable order without claiming payment succeeded. Check payment status can recover a payment without the original return URL.
- The server creates/reuses an open Checkout Session. A deterministic Stripe idempotency key plus the per-student MongoDB transaction lock prevents competing requests from creating multiple sessions. Retrieval errors never trigger a replacement. Expired sessions and confirmed failed asynchronous sessions can be retried; sessions with payment processing cannot be replaced.
- Browser verification retrieves the session directly from Stripe. The raw-body webhook verifies the Stripe signature, retrieves the current session, and invokes the same fulfillment service. Neither browser query parameters nor submitted amounts grant access.
- Fulfillment validates the order/session reference, student, payment mode, THB currency, amount, paid status and complete status, including replays of completed orders. One transaction completes the order, enrolls courses or extends Premium, clears purchased cart items and creates one notification. Concurrent verification and duplicate webhook events cannot extend Premium or enroll twice.
- Paid course content remains protected by authenticated server-side enrollment checks. Only verified fulfillment creates new paid enrollments; direct enrollment accepts free courses only. Existing paid enrollments remain valid.
- Premium calendar arithmetic, existing paid time, original start date, 500 monthly AI messages, expiration and Free's five daily messages are unchanged. No AI usage counters are reset by checkout.

## Historical data

No migration or deletion of orders, enrollments, subscriptions, notifications, payment settings or uploaded evidence is required. Legacy order fields and enums remain readable; manual orders are read-only in checkout. Legacy unfinished transfers require operational reconciliation before a student pays again. The application no longer accepts uploads or manual approval. Historical evidence should remain in private backups/storage; there is no replacement slip viewer in this release.

Removed endpoints: `/api/payment/:orderId/slip`, `/api/payment-settings` and `/qr`, `/api/admin/payment-settings` and `/qr`, and all `/api/admin/payment-verification` routes. Their admin UI and notification generators were removed after tracing all callers. The unmounted PaymentSetting model remains solely to describe retained historical data.

## Required configuration before rollout

1. Keep `STRIPE_SECRET_KEY` only in backend Azure settings. The already-configured test key keeps payments in test mode; no frontend Stripe key is needed for hosted Checkout.
2. Register `https://<backend-host>/api/stripe/webhook` in the same Stripe test environment. Subscribe to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, and `checkout.session.async_payment_failed`. Set its signing secret as backend `STRIPE_WEBHOOK_SECRET` (the API key does not replace this secret).
3. Set `FRONTEND_URL` to the exact HTTPS frontend origin. Keep API/CORS/proxy configuration consistent. The proxy must preserve the raw webhook body and `Stripe-Signature` header and allow requests without browser authentication. Express mounts the raw handler before JSON parsing.
4. Enable desired THB-compatible payment methods in Stripe. Stripe determines availability based on account, currency, amount and eligibility. Monthly Premium and course prices must meet the relevant Stripe minimum.
5. MongoDB must support transactions (replica set/Atlas). No new index or data backfill is required. Preserve the unique order reference and enrollment indexes.
6. Before release, use staging accounts and Stripe test methods to smoke-test both Premium periods, course/cart checkout, cancellations, delayed success/failure and webhook retries. Verify the webhook delivery log. No Azure/Stripe settings were changed by this implementation.

The raw-body signature and idempotency behavior follows [Stripe's Node SDK](https://github.com/stripe/stripe-node#webhook-signing) and [Stripe idempotent request guidance](https://docs.stripe.com/api/idempotent_requests).

## Limitations and operational recovery

Stripe is mocked in automated tests; webhook signatures use the real SDK and fulfillment uses a disposable local MongoDB replica set. A hosted Stripe test-mode walkthrough is still required. No real or production payment was made.

If a paid course becomes unavailable or full before fulfillment, the transaction rolls back, the webhook returns 500 for retry, and no partial access is granted. Monitor failed deliveries and reconcile/refund in Stripe if fulfillment cannot be completed. Automatic refunds, chargeback handling and access revocation are outside this migration. Unknown/non-success events do not grant access. Browser cancellation does not cancel an asynchronous payment already in progress.

Tests use temporary local data and never load an application `.env` or connect to production. Run `RUN_PAYMENT_MONGO_TESTS=true npm test --prefix backend` with `mongod` available for transaction, replay and webhook coverage, and `npm test --prefix frontend`, `npm run lint --prefix frontend`, `npm run build --prefix frontend`.
