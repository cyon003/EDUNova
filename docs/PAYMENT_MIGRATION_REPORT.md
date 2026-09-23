# Stripe migration delivery report

Implemented Stripe-only new paid-course and Premium purchases. Premium is a one-time ฿99 monthly or ฿999 yearly purchase with no automatic renewal. Course and cart checkout retain server prices and order references; free enrollment bypasses Stripe. Shared transactional verification and signed webhook fulfillment prevent duplicate enrollments, extensions and notifications. Bank-transfer, QR, slip-upload and manual approval UI/routes were removed. Historical orders, uploaded evidence, subscriptions and enrollments were not migrated or deleted.

## Validation

- Full backend suite with `RUN_PAYMENT_MONGO_TESTS`, `RUN_SUBSCRIPTION_MONGO_TESTS`, `RUN_AUTH_MONGO_TESTS`, and `RUN_TOPIC_MONGO_TESTS` enabled: **182 passed, 0 failed, 0 skipped**. Real disposable local MongoDB replica sets, mocked Stripe API, real SDK webhook signing.
- Subsequent targeted subscription unit suite, including an additional historical-default regression: **5 passed**.
- Frontend suite: **133 passed, 0 failed**.
- Frontend ESLint: passed.
- Backend `npm run check`: passed.
- Frontend production build: passed; Vite reports a bundle larger than 500 kB (non-blocking).
- `git diff --check`: passed.

Coverage includes paid Buy Now, cart and mixed/free checkout, both Premium plans, existing Premium extensions and expiration/quota behavior, ownership and amount/currency checks, unpaid/failure/cancellation paths, duplicate signed webhooks, repeated concurrent verification, transactional rollback/retry, historical preservation and disabled legacy endpoints.

No deployment, push, production data changes, secret inspection, or real Stripe charge was performed. Tests do not load application `.env` files. Sandbox-localhost restrictions required an approved run outside the sandbox.

## Configuration and limitations

See [payment workflow and production configuration](PREMIUM_PAYMENTS.md) for details. Keep the existing Azure backend Stripe test key. Configure the matching webhook signing secret and endpoint, set the HTTPS frontend origin, enable eligible THB payment methods, and confirm transaction-capable MongoDB. Hosted Stripe test-mode smoke testing remains required; automated tests mock Stripe network calls.

Historical unfinished transfers require reconciliation, not automatic conversion or recharging. Paid but unfulfillable courses produce webhook retry failures and need operational reconciliation/refund if availability cannot be restored. Automatic refund/chargeback-driven access revocation is outside scope. Retained slip evidence no longer has an application viewer.

## Changed files

- Modified: [backend/.env.example](../backend/.env.example)
- Modified: [backend/app.js](../backend/app.js)
- Modified: [backend/models/Order.js](../backend/models/Order.js)
- Modified: [backend/routes/orderRoutes.js](../backend/routes/orderRoutes.js)
- Deleted: `backend/routes/paymentAdminRoutes.js`
- Deleted: `backend/routes/paymentAdminVerificationRoutes.js`
- Deleted: `backend/routes/paymentPublicRoutes.js`
- Deleted: `backend/routes/paymentRoutes.js`
- Modified: [backend/routes/stripeRoutes.js](../backend/routes/stripeRoutes.js)
- Modified: [backend/routes/subscriptionRoutes.js](../backend/routes/subscriptionRoutes.js)
- Modified: [backend/services/notificationService.js](../backend/services/notificationService.js)
- Modified: [backend/services/stripePaymentService.js](../backend/services/stripePaymentService.js)
- Modified: [backend/services/subscriptionPaymentService.js](../backend/services/subscriptionPaymentService.js)
- Modified: [backend/tests/subscriptionPayments.test.js](../backend/tests/subscriptionPayments.test.js)
- Modified: [backend/tests/subscriptionPaymentsMongo.test.js](../backend/tests/subscriptionPaymentsMongo.test.js)
- Modified: [docs/PREMIUM_PAYMENTS.md](../docs/PREMIUM_PAYMENTS.md)
- Modified: [docs/PRODUCTION.md](../docs/PRODUCTION.md)
- Modified: [docs/PROJECT_REPORT.md](../docs/PROJECT_REPORT.md)
- Modified: [frontend/src/App.jsx](../frontend/src/App.jsx)
- Modified: [frontend/src/components/AdminLayout.jsx](../frontend/src/components/AdminLayout.jsx)
- Deleted: `frontend/src/pages/AdminPaymentVerification.jsx`
- Modified: [frontend/src/pages/AdminSettings.jsx](../frontend/src/pages/AdminSettings.jsx)
- Deleted: `frontend/src/pages/CheckoutPage.jsx`
- Modified: [frontend/src/pages/StripeCheckout.jsx](../frontend/src/pages/StripeCheckout.jsx)
- Modified: [frontend/src/pages/Subscription.jsx](../frontend/src/pages/Subscription.jsx)
- Deleted: `frontend/src/styles/AdminPaymentVerification.css`
- Modified: [frontend/src/styles/CheckoutPage.css](../frontend/src/styles/CheckoutPage.css)
- Modified: [frontend/tests/learningSignalTracking.test.js](../frontend/tests/learningSignalTracking.test.js)
- Modified: [frontend/tests/subscriptionPayments.test.js](../frontend/tests/subscriptionPayments.test.js)
- Added: [backend/routes/stripeWebhook.js](../backend/routes/stripeWebhook.js)
- Added: [backend/services/stripeCheckoutService.js](../backend/services/stripeCheckoutService.js)
- Added: [docs/PAYMENT_MIGRATION_REPORT.md](../docs/PAYMENT_MIGRATION_REPORT.md)
