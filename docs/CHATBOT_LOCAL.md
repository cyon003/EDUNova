# Direct Gemini chatbot: local refactor

## Current local flow

React → POST /api/ai/chat → Express authentication, validation, rate limit and quota reservation → recent MongoDB conversation context → `geminiService.generateAnswer()` → Google Gemini API → save conversation → commit usage → React.

The official Node SDK is `@google/genai` (^2.22.0). Backend-only configuration requires `GEMINI_API_KEY`; `GEMINI_MODEL` defaults to the existing `gemini-3.6-flash`. The local backend environment received the existing chatbot Gemini settings without changing MongoDB configuration. Optional settings are documented in `backend/.env.example`. No frontend key is used.

The original educational system prompt, simple/expanded response styles, bounded context, response normalization, one continuation for token-limited answers, and safe error mapping are preserved. The total Gemini deadline includes continuation and remains below the quota reservation lease. Failed provider calls or history saves release reservations. Free stays at 5 successful messages per UTC day and Premium at 500 per UTC month.

## Verification

From `backend/`:

```sh
RUN_SUBSCRIPTION_MONGO_TESTS=true node --test tests/geminiService.test.js tests/aiRoutes.test.js tests/subscription.test.js tests/subscriptionMongo.test.js tests/learningSignals.test.js tests/productionEnvironment.test.js
```

All 40 checks passed across the targeted run and corrected MongoDB integration rerun (31 other checks plus 9 MongoDB checks, including its parent). Coverage includes prompt/context, response normalization, provider errors, authentication, actual MongoDB history writes, Free/Premium limits, concurrency, refunds, rate limits and existing confusion prediction routes. Changed route/service syntax checks and `git diff --check` passed. Provider responses were mocked; no live Gemini call was made. No frontend test/build was needed because its contract is unchanged.

The MongoDB integration test starts a disposable localhost database in the OS temporary directory. It never reads application `.env` or uses staging data.

## Deployment configuration

The legacy Python tutor and its deployment unit have been removed locally.
The backend unit loads Gemini settings from `/etc/edunova/backend.env`.
The remaining application units run Express and Confusion Detection.
See [PRODUCTION.md](PRODUCTION.md) for the current deployment configuration.
No VM deployment is performed by this cleanup.

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
