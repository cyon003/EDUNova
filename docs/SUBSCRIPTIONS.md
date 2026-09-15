# Local subscriptions

## Behavior

- Existing accounts automatically behave as Free. No migration is needed.
- Students: Free has 5 successful AI messages per UTC day; Premium has 500 per UTC calendar month, including yearly subscribers.
- Premium pricing: ฿99/month or ฿999/year. Expiration returns the effective plan to Free. Cancellation switches immediately to Free; there is no automatic billing or renewal.
- Tutor/Admin accounts have no subscription quota. Their existing per-minute abuse limiter still applies.
- Course access, paid course checkout, enrollment and confusion detection retain their existing rules. Premium does not buy courses.
- History remains available to both plans. The backend Gemini service has a bounded context budget, so this implementation does not advertise extended history as an additional Premium benefit.
- Quotas are separate from conversation history. Clearing history or switching plans does not erase usage for the current daily/monthly bucket.
- Atomic MongoDB reservations prevent concurrent requests from overbooking capacity. Successful saved answers commit usage; failed requests release reservations. Abandoned reservations expire after ten minutes. This works on standalone MongoDB without transactions or a migration.
- A process/database failure between saving history and committing usage can leave a saved answer without committed usage. Reservations conservatively occupy capacity until released or expired. Network failures after a committed answer cannot undo that successful generation.

## Local startup

Keep the existing local `.env` files and database settings. Start each service in a separate terminal from the project root:

```sh
cd backend
npm run dev
```

```sh
cd frontend
npm run dev
```

```sh
cd confusion-service
venv/bin/python app.py
```

Open `/subscription`, or use the new plan panel in `/profile` or `/ai-tutor`.

## Simulate Premium locally

The only new application environment variable is `ENABLE_DEV_SUBSCRIPTIONS`, default `false`, documented in `backend/.env.example`. It enables the admin simulation endpoint only when `NODE_ENV` is exactly `development`. Missing, test, staging and production environments cannot use it.

1. In your existing **local** `backend/.env`, set `ENABLE_DEV_SUBSCRIPTIONS=true` and ensure `NODE_ENV=development`. Restart the backend.
2. Sign in to the local frontend as an existing Admin.
3. In that page's browser developer console, run the following. This uses the app's installed authenticated fetch wrapper and existing in-memory JWT/refresh mechanism. Do not copy tokens out of the app.

```js
const { API_ROOT: api } = await import("/src/utils/courseApi.js"); // Vite development server
const result = await fetch(`${api}/admin/students`).then(r => r.json());
console.log(result); // locate the target student's _id in the response
```

Use that student's `_id`:

```js
await fetch(`${api}/subscription/dev/simulate`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    userId: "REPLACE_WITH_STUDENT_ID",
    plan: "premium",
    billingCycle: "monthly" // or "yearly"
  })
}).then(r => r.json());
```

To simulate Free:

```js
await fetch(`${api}/subscription/dev/simulate`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ userId: "REPLACE_WITH_STUDENT_ID", plan: "free" })
}).then(r => r.json());
```

The action is recorded in the existing AdminAudit collection. Sign back in as the student to inspect the plan. Active pages refresh usage every 30 seconds and on window focus. Disable `ENABLE_DEV_SUBSCRIPTIONS` when finished.

## API

All routes require existing JWT authentication:

- `GET /api/subscription/me`: effective plan, lifecycle dates, usage, remaining capacity (subtracts in-flight reservations), UTC reset time; staff receive `aiUsage.exempt: true` and null limits.
- `POST /api/subscription/upgrade`: student only; accepts exactly `{ "billingCycle": "monthly" | "yearly" }`. Returns `503 PAYMENTS_NOT_AVAILABLE` without changing the account. The existing manual course-payment system is not a subscription gateway.
- `POST /api/subscription/cancel`: student only; accepts `{}` and immediately switches to Free.
- `POST /api/subscription/dev/simulate`: development + explicit flag + existing Admin role; validates student ID, plan and billing cycle. Unavailable outside development.
- Existing `POST /api/ai/chat`: retains short-term limiting; subscription exhaustion returns `429 AI_QUOTA_EXCEEDED` with plan, limit, usage and reset time.

## Verification

```sh
cd backend
npm run check
npm test
# Also run real MongoDB concurrency and HTTP coverage (mongod must be on PATH):
RUN_SUBSCRIPTION_MONGO_TESTS=true npm test
```

The integration test starts a disposable localhost MongoDB process on an available port in the OS temporary directory. It never loads `.env`, connects to your application database, or calls Gemini. Without the opt-in variable, this integration test is explicitly skipped.

```sh
cd frontend
npm test
npm run lint
npm run build
```

Coverage includes legacy users, 5/500 limits, UTC resets, concurrent reservations, failed provider/history writes, expired leases/subscriptions, history deletion, authentication, promotion attempts, development/production guards, cancellation, staff exemptions and existing rate limiting.

## File inventory

Created:

- `backend/models/AiUsage.js`
- `backend/services/subscriptionService.js`
- `backend/routes/subscriptionRoutes.js`
- `backend/tests/subscription.test.js`
- `backend/tests/subscriptionMongo.test.js`
- `frontend/src/hooks/useSubscription.js`
- `frontend/src/components/SubscriptionSummary.jsx`
- `frontend/src/pages/Subscription.jsx`
- `frontend/src/styles/Subscription.css`
- `docs/SUBSCRIPTIONS.md`

Modified:

- `backend/.env.example`
- `backend/app.js`
- `backend/models/User.js`
- `backend/routes/aiRoutes.js`
- `backend/tests/aiRoutes.test.js`
- `frontend/src/App.jsx`
- `frontend/src/pages/AiChatbot.jsx`
- `frontend/src/pages/Profile.jsx`
