# EDUNova production setup

## Backend environment

Copy `backend/.env.example` to `backend/.env` and replace every placeholder.
Production requires:

- `NODE_ENV=production`
- `MONGO_URI` for the production MongoDB database
- a random `JWT_SECRET` containing at least 32 characters
- `FRONTEND_URL` or comma-separated `CORS_ORIGINS`
- `TRUST_PROXY=1` only when Express is behind one trusted HTTPS reverse proxy
- valid SMTP values for email delivery
- `PYTHON_CHATBOT_URL` pointing to the private Flask service
- `PYTHON_CONFUSION_URL` pointing to the private confusion-prediction service
- a suitable `PYTHON_CHATBOT_TIMEOUT_MS` and assistant rate limit
- `AI_GENERAL_RATE_LIMIT_PER_MINUTE`

Never commit the real `.env` file or email app password.

## Python General AI Tutor service

Use Python 3.10 or newer. Install the service in an isolated environment:

```bash
cd chatbot-service
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python3 chatbot.py
```

For production, use Gunicorn rather than Flask's development server:

```bash
gunicorn --workers 2 --bind "${CHATBOT_HOST:-127.0.0.1}:${CHATBOT_PORT:-5001}" chatbot:app
```

Bind to `127.0.0.1` when it shares a host with Express, or set `CHATBOT_HOST=0.0.0.0` only on a private application network. The public proxy must not expose `/chat`; only Express should reach the Python service.

```env
AI_PROVIDER=gemini
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.6-flash
GEMINI_TIMEOUT_SECONDS=60
GEMINI_MAX_OUTPUT_TOKENS=1600
GEMINI_MAX_ANSWER_LENGTH=8000
CHATBOT_HOST=127.0.0.1
CHATBOT_PORT=5001
```

Store the key only in the Flask service environment or ignored `.env`; never expose it to Express, React, logs, or health responses. Allow outbound HTTPS from Flask to the Gemini API. Set Express `PYTHON_CHATBOT_TIMEOUT_MS=70000` so it safely exceeds the default Gemini timeout.

General AI Tutor requests contain no course identifiers, lesson identifiers, documents, sources, or retrieval metadata. Express remains responsible for JWT verification, MongoDB access, rate limiting, timeouts, and user-owned general history. General failures return a fixed safe response. Keep outbound Gemini access restricted to the Flask service and monitor quota usage.

## Lesson resources

Leave `UPLOAD_ROOT` empty in local development to use `backend/uploads`. In production, mount persistent storage and set an absolute path such as `UPLOAD_ROOT=/persistent/edunova/uploads`. At startup, Express creates the required subdirectories (`course-covers`, `course-videos`, `lesson-posters`, `lesson-resources`, `payment-qr`, `payment-slips`, `profile-photos`, and `tutor-applications`) beneath that root. The mounted root must be readable and writable by the operating-system user running Express; do not make payment slips or tutor-application files public at the reverse proxy. Back up the complete upload root together with MongoDB, since database records reference its generated filenames. Generated stored names are resolved only inside approved upload directories; unsafe paths are rejected. Resource contents are not extracted or sent to Gemini.

## Confusion prediction service

Provision the trained model bundle separately: generated models are ignored by Git and will not arrive in a source deployment. Mount the existing bundle and either keep its versioned default location or set `MODEL_BUNDLE_PATH` to the mounted file.

```bash
cd confusion-service
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python3 app.py

# Production
gunicorn --workers 2 --bind "${CONFUSION_HOST:-127.0.0.1}:${CONFUSION_PORT:-5002}" 'app:create_app()'
```

```env
PYTHON_CONFUSION_URL=http://127.0.0.1:5002
PYTHON_CONFUSION_TIMEOUT_MS=5000
CONFUSION_HOST=127.0.0.1
CONFUSION_PORT=5002
MODEL_BUNDLE_PATH=/srv/edunova-models/confusion-random-forest-3b-v1.joblib
```

Only the backend should call `/predict`. The service fails at startup with an actionable error if its bundle is missing.

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
TRUST_PROXY=1
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

When frontend and backend use separate origins, set `VITE_API_ORIGIN` at frontend build time. Configure the reverse proxy to forward WebSocket upgrades for Socket.IO and to send `X-Forwarded-Proto`; set `TRUST_PROXY=1` only for that known proxy hop.
