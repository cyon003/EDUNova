# EDUNova production setup

## Backend environment

Copy `backend/.env.example` to `backend/.env` and replace every placeholder.
Production requires:

- `NODE_ENV=production`
- `MONGO_URI` for the production MongoDB database
- a random `JWT_SECRET` containing at least 32 characters
- `FRONTEND_URL` or comma-separated `CORS_ORIGINS`
- valid SMTP values for email delivery
- `PYTHON_CHATBOT_URL` pointing to the private Flask service
- a suitable `PYTHON_CHATBOT_TIMEOUT_MS` and assistant rate limit
- `AI_COURSE_RATE_LIMIT_PER_MINUTE` and the stricter `AI_GENERAL_RATE_LIMIT_PER_MINUTE`

Never commit the real `.env` file or email app password.

## Python course-assistant service

Use Python 3.10 or newer. Install the service in an isolated environment:

```bash
cd chatbot-service
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python3 chatbot.py
```

Run it under a production process supervisor with Flask debug mode disabled. Bind it to `127.0.0.1` when it shares a host with Express, or place it on a private application network. The public proxy must not expose `/chat`; only Express should reach the Python service. Apply host-level resource limits because TF-IDF vectors are computed per request.

```env
AI_PROVIDER=gemini
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.6-flash
GEMINI_TIMEOUT_SECONDS=60
GEMINI_MAX_OUTPUT_TOKENS=1600
GEMINI_MAX_ANSWER_LENGTH=8000
```

Store the key only in the Flask service environment or ignored `.env`; never expose it to Express, React, logs, or health responses. Allow outbound HTTPS from Flask to the Gemini API. Set Express `PYTHON_CHATBOT_TIMEOUT_MS=70000` so it safely exceeds the default Gemini timeout.

The service retrieves only the bounded documents Express supplies. Low relevance bypasses generation. Gemini failures return an extractive passage rather than a service error. Express remains responsible for JWT verification, role and enrollment checks, MongoDB access, rate limiting, timeouts, source validation, and user-owned conversation history.

General AI Tutor requests contain no course identifiers, documents, or sources. They use a separate rate limit and same-mode history scope. General failures return a fixed safe unavailable response rather than course text. Keep outbound Gemini access restricted to the Flask service and monitor free-tier quota usage.

For an existing deployment, run the idempotent conversation migration once before serving the new API:

```bash
cd backend
npm run migrate:chatbot-modes
```

## Lesson-resource extraction

The Express process extracts PDF, DOCX, and TXT text locally and stores bounded chunks in MongoDB. Configure:

```env
RESOURCE_EXTRACTION_MAX_FILE_BYTES=15728640
RESOURCE_EXTRACTION_MAX_CHARACTERS=200000
RESOURCE_EXTRACTION_MAX_CHUNKS=200
RESOURCE_EXTRACTION_CHUNK_SIZE=1200
AI_CHATBOT_MAX_TOTAL_TEXT=100000
AI_CHATBOT_MAX_DOCUMENTS=100
```

The upload directory must be persistent and writable by Express. Keep it outside the public deployment artifact and back it up together with MongoDB. Generated stored names are resolved only inside `backend/uploads/lesson-resources`; unsafe paths are rejected.

After deploying the schema and extractor dependencies, process older resources once:

```bash
cd backend
npm run reprocess:lesson-resources
```

The command is safe to rerun. Monitor failed statuses from the tutor interface. Image-only PDFs are not OCR-processed, and password-protected or damaged files may fail without affecting the lesson record.

## Frontend environment

If frontend and backend are on different origins, create `frontend/.env.production`:

```env
VITE_API_ORIGIN=https://api.example.com
```

Leave `VITE_API_ORIGIN` empty when a reverse proxy serves `/api` and `/uploads` from the same origin.

## Authentication sessions

Configure the Express environment with:

```env
ACCESS_TOKEN_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_DAYS=30
REFRESH_COOKIE_NAME=edunova_refresh
FRONTEND_URL=https://www.example.com
NODE_ENV=production
```

Access JWTs are short-lived and held in browser memory. Persistent sessions use rotating opaque refresh tokens in a `Secure`, `HttpOnly`, `SameSite=Lax` cookie scoped to `/api/auth`; MongoDB stores only SHA-256 token hashes in the `refreshsessions` collection. Keep the frontend and API same-site. If a future deployment requires `SameSite=None`, add a synchronizer-token or signed double-submit CSRF defense before enabling cross-site cookies.

CORS accepts only `FRONTEND_URL` or the comma-separated `CORS_ORIGINS` allowlist and permits credentials for those exact origins. Login and refresh are rate-limited. Account suspension, deletion, password reset, tutor approval changes, and role changes revoke every refresh session immediately. Protected requests load the current user and role from MongoDB, so authorization changes take effect immediately even while an older access JWT remains unexpired.

## Verify before deployment

```bash
cd chatbot-service
source venv/bin/activate
python3 -m unittest discover -s tests -v

cd backend
npm ci
npm run check
npm test

cd ../frontend
npm ci
npm test
npm run lint
npm run build
```

Start the backend with `npm start`. Deploy the generated `frontend/dist` directory using a static web server. Configure HTTPS and make `/api` and `/uploads` reach the backend when using a same-origin deployment.
