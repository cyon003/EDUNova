# Direct Gemini chatbot: local refactor

## Current local flow

React → POST /api/ai/chat → Express authentication, validation, rate limit and quota reservation → recent MongoDB conversation context → `geminiService.generateAnswer()` → Google Gemini API → save conversation → commit usage → React.

The official Node SDK is `@google/genai` (^2.22.0). Backend-only configuration requires `GEMINI_API_KEY`; `GEMINI_MODEL` defaults to the existing `gemini-3.6-flash`. The local backend environment received the existing chatbot Gemini settings without changing MongoDB configuration. Optional settings are documented in `backend/.env.example`. No frontend key is used.

The original educational system prompt, simple/expanded response styles, bounded context, response normalization, one continuation for token-limited answers, and safe error mapping are preserved. The total Gemini deadline includes continuation and remains below the quota reservation lease. Failed provider calls or history saves release reservations. Free stays at 5 successful messages per UTC day and Premium at 500 per UTC month.

## Files in this refactor

Created:
- `backend/services/geminiService.js`
- `backend/tests/geminiService.test.js`
- `docs/CHATBOT_LOCAL.md`

Modified (preserving existing subscription changes):
- `backend/routes/aiRoutes.js`
- `backend/config/environment.js`
- `backend/package.json`, `backend/package-lock.json`
- `backend/.env` (ignored), `backend/.env.example`
- `backend/tests/aiRoutes.test.js`
- `backend/tests/subscriptionMongo.test.js`
- `backend/tests/productionEnvironment.test.js`
- `README.md`, `docs/SUBSCRIPTIONS.md`, `docs/PROJECT_REPORT.md`
- `chatbot-service/README.md` (legacy notice)

Removed generated files only:
- `chatbot-service/venv/`
- `chatbot-service/__pycache__/`
- `chatbot-service/tests/__pycache__/`

No frontend implementation, confusion-service files, Azure deployment files, or staging database settings were changed by this refactor. Other pre-existing uncommitted changes were preserved.

## Verification

From `backend/`:

```sh
RUN_SUBSCRIPTION_MONGO_TESTS=true node --test tests/geminiService.test.js tests/aiRoutes.test.js tests/subscription.test.js tests/subscriptionMongo.test.js tests/learningSignals.test.js tests/productionEnvironment.test.js
```

All 40 checks passed across the targeted run and corrected MongoDB integration rerun (31 other checks plus 9 MongoDB checks, including its parent). Coverage includes prompt/context, response normalization, provider errors, authentication, actual MongoDB history writes, Free/Premium limits, concurrency, refunds, rate limits and existing confusion prediction routes. Changed route/service syntax checks and `git diff --check` passed. Provider responses were mocked; no live Gemini call was made. No frontend test/build was needed because its contract is unchanged.

The MongoDB integration test starts a disposable localhost database in the OS temporary directory. It never reads application `.env` or uses staging data.

## Retained legacy/deployment references

There is no application runtime reference to the Flask chatbot URL or port 5001 in the active backend/frontend. `chatbot-service/` is unused by the new local application, but is not completely unreferenced: the unchanged Azure deployment still targets it. Source, tests and environment examples are retained for that transition; the ignored legacy `.env` is also retained. Recreate its virtual environment from requirements if needed for legacy use.

Port 5001 remains in the legacy chatbot source/test/example/README and in:
- `deploy/azure/edunova-chatbot.service`
- `docs/PRODUCTION.md`

Later deployment work (not performed): retire `deploy/azure/edunova-chatbot.service`, revise `docs/PRODUCTION.md`, and move Gemini configuration into `/etc/edunova/backend.env` (already loaded by `edunova-backend.service`). Nginx and the confusion service need no routing change for this refactor. Delete the legacy chatbot source only after deployment references are retired.

## Manual local test

Keep the existing environment files. In separate terminals:

```sh
# Terminal 1: start your local MongoDB, if needed
brew services start mongodb-community
```

```sh
# Terminal 2: explicitly use local MongoDB without editing the existing URI
cd /Users/xavier/Desktop/EDUNova/backend
NODE_ENV=development MONGO_URI=mongodb://127.0.0.1:27017/edunova npm run dev
```

```sh
# Terminal 3
cd /Users/xavier/Desktop/EDUNova/frontend
npm run dev
```

Open `http://localhost:5173/ai-tutor` and sign in with a local account. Send “Explain fractions”, then “Explain more”. Confirm both answers, reload to confirm saved history, and inspect the Free usage counter. A sixth successful message in the same UTC day should be rejected; wait for the per-minute limiter if necessary. Premium simulation instructions remain in `docs/SUBSCRIPTIONS.md`.

No Python chatbot process is needed. Confusion Detection still uses its existing separate Python/Flask process on port 5002; its implementation/configuration are unchanged.
