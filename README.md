# EDUNova

EDUNova is a React, Express, MongoDB learning platform with student, tutor, and administrator workflows. Its General AI Tutor uses Gemini for general educational explanations without accessing EDUNova course materials.

## Requirements

- Node.js 20 or newer
- MongoDB 7 or newer
- Python 3.10 or newer

## Local setup

Start MongoDB using your normal local installation, for example Homebrew:

```bash
brew services start mongodb-community
```

Start Express (for a new setup, copy the example once; preserve an existing `.env`):

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

In another terminal, start React:

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Open `http://localhost:5173`, sign in, then open `/ai-tutor`. The legacy `/ai-chatbot` URL redirects there.

## General AI Tutor configuration

Express calls Gemini directly using the official `@google/genai` SDK. Set these variables only in `backend/.env`:

```env
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.6-flash
GEMINI_TIMEOUT_SECONDS=60
GEMINI_MAX_OUTPUT_TOKENS=1600
GEMINI_MAX_ANSWER_LENGTH=8000
GEMINI_MAX_PROMPT_CHARACTERS=30000
AI_GENERAL_RATE_LIMIT_PER_MINUTE=5
AI_CHATBOT_RECENT_CONTEXT_LIMIT=3
```

The backend preserves the educational prompt, recent conversation, continuation handling, safe provider errors, and subscription reservations/refunds. The total Gemini operation is bounded by `GEMINI_TIMEOUT_SECONDS`, including any continuation. No Python chatbot process is required locally. Confusion Detection still uses its separate Python service on port 5002.

## Architecture

```text
React/Vite (browser; static files served by Nginx)
↓
Nginx [Azure VM]
↓
Node.js/Express [Azure VM]
├── Gemini API [External]
├── MongoDB Atlas [External]
└── Confusion Detection Flask service :5002 [Azure VM]
```

The deployment configuration runs Express and Confusion Detection. Gemini settings
belong in the backend environment. See [docs/PRODUCTION.md](docs/PRODUCTION.md)
and [docs/CHATBOT_LOCAL.md](docs/CHATBOT_LOCAL.md).

Express verifies the JWT, applies the General AI Tutor rate limit, loads only that user’s bounded general-mode history, and calls Gemini directly with the question and context. Course identifiers, lesson identifiers, documents, sources, follow-up retrieval metadata, and `mode=course` are rejected. Answers are labeled as unverified general knowledge. Existing course-mode records are left untouched until an approved database migration.

Supporting lesson files remain normal protected uploads. They can be viewed or downloaded by authorized users, but their contents are not extracted or sent to the General AI Tutor.

Current limitations:

- Gemini availability and free-tier quota depend on the configured Google AI project.
- Gemini failures return a bounded, safe General AI Tutor error without exposing course content.

## Tests

```bash
cd backend
npm run check
npm test

cd ../frontend
npm test
npm run lint
npm run build
```

See [docs/PRODUCTION.md](docs/PRODUCTION.md) for deployment guidance.
