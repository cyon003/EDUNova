# EDUNova production setup for an Azure Linux VM

This runbook prepares one HTTPS VM deployment. It does not copy real secrets
into the repository and it assumes MongoDB Atlas or a MongoDB replica set.
EDUNova uses database transactions for checkout and payment approval, so a
standalone MongoDB server is deliberately rejected in production.

## Deployment layout and prerequisites

Use Ubuntu LTS or another supported Azure Linux image, open only TCP 22, 80,
and 443 in the Azure network security group, and use SSH keys. Keep ports
5050, 5001, and 5002 private on loopback. Point DNS for the chosen domain at
the VM before enabling the TLS certificate.

Install Node.js 20+, Python 3.10+, Nginx, Certbot, Git, and MongoDB tooling.
Create a service account and writable upload/model locations:

```bash
sudo useradd --system --create-home --shell /usr/sbin/nologin edunova
sudo install -d -o edunova -g edunova -m 0750 /srv/edunova /srv/edunova/uploads /srv/edunova/models
sudo install -d -o root -g edunova -m 0750 /etc/edunova
sudo -u edunova git clone <YOUR_PRIVATE_REPOSITORY_URL> /srv/edunova
```

Use a transaction-capable `MONGO_URI`: MongoDB Atlas provides this by default;
a self-hosted single VM needs MongoDB configured as a single-member replica
set. The backend verifies that production MongoDB supports transactions during
startup.

## Initial install

```bash
cd /srv/edunova/backend && npm ci
cd /srv/edunova/frontend && npm ci && npm run build
cd /srv/edunova/chatbot-service && python3 -m venv venv && venv/bin/pip install -r requirements.txt
cd /srv/edunova/confusion-service && python3 -m venv venv && venv/bin/pip install -r requirements.txt
```

Copy the already trained `confusion-random-forest-3b-v1.joblib` through a
secure operator channel to `/srv/edunova/models/`, then make it readable by
the service account but not the public:

```bash
sudo install -o edunova -g edunova -m 0640 /secure/source/confusion-random-forest-3b-v1.joblib /srv/edunova/models/confusion-random-forest-3b-v1.joblib
```

Generated model files are ignored by Git. Do not retrain or substitute a model
during deployment. The saved bundle was created with Python 3.10.11 and
scikit-learn 1.7.2; install the locked compatible environment and confirm the
model health endpoint before enabling the backend.

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
- an absolute, writable `UPLOAD_ROOT=/srv/edunova/uploads`
- transactional MongoDB (Atlas or a replica set)

Never commit the real `.env` file or email app password.

Store environment files outside the release tree. For example,
`/etc/edunova/backend.env` must contain these values with real values supplied
by the operator:

```env
NODE_ENV=production
PORT=5050
TRUST_PROXY=1
MONGO_URI=<transaction-capable MongoDB connection string>
JWT_SECRET=<at least 32 random characters>
FRONTEND_URL=https://example.com
CORS_ORIGINS=https://example.com
UPLOAD_ROOT=/srv/edunova/uploads
ACCESS_TOKEN_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_DAYS=30
REFRESH_COOKIE_NAME=edunova_refresh
PYTHON_CHATBOT_URL=http://127.0.0.1:5001
PYTHON_CHATBOT_TIMEOUT_MS=70000
PYTHON_CONFUSION_URL=http://127.0.0.1:5002
PYTHON_CONFUSION_TIMEOUT_MS=5000
AI_GENERAL_RATE_LIMIT_PER_MINUTE=5
AI_CHATBOT_RECENT_CONTEXT_LIMIT=3
EMAIL_HOST=<SMTP host>
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=<SMTP username>
EMAIL_PASSWORD=<SMTP app password>
EMAIL_FROM=EDUNOVA <no-reply@example.com>
```

Create `/etc/edunova/chatbot.env` from the chatbot example plus the actual
`GEMINI_API_KEY`, and `/etc/edunova/confusion.env` from the confusion example
with `MODEL_BUNDLE_PATH=/srv/edunova/models/confusion-random-forest-3b-v1.joblib`.
Both services retain loopback host values.

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

## Nginx, TLS, and automatic service startup

Copy the checked-in service definitions and proxy configuration, replacing
`example.com` with the real domain before enabling Nginx:

```bash
sudo cp /srv/edunova/deploy/azure/edunova-*.service /etc/systemd/system/
sudo cp /srv/edunova/deploy/azure/edunova.nginx.conf /etc/nginx/sites-available/edunova
sudo ln -s /etc/nginx/sites-available/edunova /etc/nginx/sites-enabled/edunova
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d example.com -d www.example.com
sudo systemctl daemon-reload
sudo systemctl enable --now edunova-chatbot edunova-confusion edunova-backend
```

Check private services from the VM only, then check the public HTTPS path:

```bash
curl --fail http://127.0.0.1:5001/health
curl --fail http://127.0.0.1:5002/health
curl --fail https://example.com/api/health
sudo journalctl -u edunova-backend -u edunova-chatbot -u edunova-confusion -n 100 --no-pager
```

The Nginx configuration forwards `/socket.io/` with WebSocket upgrade headers.
The frontend uses a same-origin API URL by default, so leave
`VITE_API_ORIGIN` empty for this configuration.

## Backup, update, and rollback

Back up MongoDB and uploads as one logical recovery point. Run a restore test
on a non-production database and storage directory before launch. The upload
directory contains media plus private payment and application evidence; never
make it a public object-store bucket without access controls.

For each release: take a database/upload backup, record the running Git commit,
fetch the approved commit, run `npm ci` for backend and frontend, rebuild the
frontend, reinstall Python requirements only when their lock/requirements
change, run the verification commands above, then restart the three units.

If validation fails, restore the previous commit and dependency state, rebuild
the prior frontend, restart the units, and restore database/uploads together
only when the failed release has written incompatible data. Review logs before
retrying. Never roll back an order or payment record by deleting it manually.

## Post-deployment validation requiring real credentials

Use dedicated staging accounts and test data. Verify HTTPS cookies and session
refresh, an unauthorized API/media request, a normal student/tutor/admin flow,
SMTP password reset delivery, a Gemini response and quota/provider error, a
Socket.IO message, one uploaded resource, and the model prediction endpoint.
Do not send payment slips to real users or process real payments while testing.
