# Inactive-tab session investigation

## Findings and evidence

The reported production logout after 10–15 inactive minutes could not be uniquely attributed without the failing refresh response, frontend/API hostnames and configured database session timeout. No production configuration, cookies, tokens or database records were inspected. The implementation must not be described as proof of the production trigger.

A concrete false-logout path was reproduced before modifying implementation: `authMiddleware` caught database lookup failures as well as JWT errors and returned 401. The regression expected 503 and failed with `401 !== 503`. On Profile, a remaining endpoint 401 independently called `clearSession()` and redirected to login, even if centralized refresh had succeeded. Both defects are fixed. Authentication database failures return 503 without leaking error details, while invalid/expired JWTs still return 401. Profile now delegates session invalidation to the auth client.

The client already refreshed expired access tokens reactively after API 401, deduplicated same-tab refreshes and serialized cookie-changing requests with a Web Lock across same-origin tabs. Tests confirm these mechanisms work. App restored only on mount; there was no focus/visibility refresh. A hidden tab could retain an expired access token until a request occurred. New resume handlers refresh an expired token when visible, and API requests preflight expired tokens using the same promise/lock. There is no background timer or unconditional refresh on every focus. Decoded expiry only schedules renewal; it never authorizes a request.

## Security and response handling retained

- Access tokens default to 15 minutes. The database `sessionTimeout` is an **absolute** session deadline (default 30 minutes from login), not an inactivity timeout. Returning after that deadline still requires login. No lifetime, deadline or rotation policy changed.
- Refresh 401 is definitive; invalid, expired or revoked sessions still clear local identity. Refresh network errors, lock timeout, 429 and 5xx are recoverable and preserve identity. Ordinary API 429/5xx do not rotate or log out. Endpoint 401 retries once after refresh; an endpoint response alone is not authority to clear the whole session.
- Backend refresh rotation remains transactional. Replaying a consumed refresh token still revokes its family. Same-origin tabs serialize rotation and send the latest shared cookie; tabs do not share access tokens. No reuse grace period was added.
- Refresh cookies remain HttpOnly, Secure in production, SameSite=Lax and scoped to `/api/auth`, with expiry bounded by the absolute session deadline. Frontend/API must be same-site. Different Azure sites can block this cookie on fetch even with `credentials: include`; the next access-token expiry would then expose a missing-cookie 401. This is a deployment hypothesis, not a confirmed finding. No SameSite weakening or CSRF bypass was introduced.
- Web Locks require supported browsers and a secure context. Unsupported coordination fails recoverably rather than risking refresh-token reuse. Different frontend origins do not share a Web Lock; use a canonical application origin.

## Regression coverage and validation

Frontend tests simulate a 16-minute clock advance without real sleeps, then visibility/focus plus concurrent requests; only one same-tab rotation occurs and expired tokens are not sent. Two inactive tabs use the latest shared cookie sequentially. Tests cover recoverable 429/500/503, definitive refresh 401, ordinary API errors and Profile's false-logout path. Existing tests cover network failure, delayed 401, socket recovery and lock contention.

Backend tests verify infrastructure failures are 503 and expired/forged JWTs remain 401. The disposable local MongoDB auth suite verifies cookie protections, transactional rotation, rollback after failures, replay revocation, concurrent direct replay rejection and absolute deadlines.

- Backend suite with `RUN_AUTH_MONGO_TESTS=true`: 155 passed, 0 failed, 3 unrelated opt-in MongoDB suites skipped.
- Frontend suite: 141 passed, 0 failed.
- Frontend lint, production build and backend syntax checks passed. Build retains the existing large-bundle warning.

Changed files: `backend/middleware/authMiddleware.js`, `backend/tests/authMiddlewareReliability.test.js`, `frontend/src/utils/authClient.js`, `frontend/src/App.jsx`, `frontend/src/pages/Profile.jsx`, `frontend/tests/sessionReliability.test.js`, and this report. `authRoutes.js`, `sessionService.js`, cookie settings and token lifetimes were inspected and left unchanged.

No deployment or push. If the symptom persists, capture only refresh HTTP status and response code/message, frontend/API hostnames, and elapsed time since login—not credentials or cookie/token values—to distinguish the preserved absolute deadline, cookie delivery, revocation and temporary infrastructure errors.
