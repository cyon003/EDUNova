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

Start the private Python General AI Tutor service:

```bash
cd chatbot-service
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Copy `chatbot-service/.env.example` to `chatbot-service/.env`, add the Gemini API key locally, then activate `chatbot-service/venv` and run `python3 chatbot.py`.

In another terminal, start Express:

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

In a third terminal, start React:

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Open `http://localhost:5173`, sign in, then open `/ai-tutor`. The legacy `/ai-chatbot` URL redirects there.

## General AI Tutor configuration

Express uses these backend environment variables:

```env
PYTHON_CHATBOT_URL=http://127.0.0.1:5001
PYTHON_CHATBOT_TIMEOUT_MS=70000
AI_GENERAL_RATE_LIMIT_PER_MINUTE=5
AI_CHATBOT_RECENT_CONTEXT_LIMIT=3
RESOURCE_EXTRACTION_MAX_FILE_BYTES=15728640
RESOURCE_EXTRACTION_MAX_CHARACTERS=200000
RESOURCE_EXTRACTION_MAX_CHUNKS=200
RESOURCE_EXTRACTION_CHUNK_SIZE=1200
```

The Python service uses:

```env
AI_PROVIDER=gemini
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.6-flash
GEMINI_TIMEOUT_SECONDS=60
GEMINI_MAX_OUTPUT_TOKENS=1600
GEMINI_MAX_ANSWER_LENGTH=8000
```

Optional service variables include `CHATBOT_HOST`, `CHATBOT_PORT`, `CHATBOT_MAX_MESSAGE_LENGTH`, `CHATBOT_MAX_REQUEST_BYTES`, and `GEMINI_MAX_PROMPT_CHARACTERS`.

Express verifies the JWT, applies the General AI Tutor rate limit, loads only that user’s bounded general-mode history, and sends the question and context to the private Flask service. Course identifiers, lesson identifiers, documents, sources, follow-up retrieval metadata, and `mode=course` are rejected. Answers are labeled as unverified general knowledge. Existing course-mode records are left untouched until an approved database migration.

TF-IDF functions and their Python dependency remain dormant during Phase 1 and are scheduled for Phase 2 removal; they are not reachable through `POST /chat`.

PDF, DOCX, and TXT lesson resources are extracted locally during upload. PDF.js preserves page numbers, Mammoth reads raw DOCX text, and Node reads TXT files. Normalized bounded chunks are stored in the separate `lessonresourcechunks` MongoDB collection. Tutors can see extraction state and retry failed resources. Extraction failure does not fail lesson creation.

To safely process resources uploaded before this feature, or reprocess all supported resources after changing limits, run:

```bash
cd backend
npm run reprocess:lesson-resources
```

The command is idempotent: chunks are upserted by resource and chunk number, and stale chunks are removed.

Current limitations:

- Scanned/image-only PDFs require OCR and therefore produce a safe failed/empty extraction status.
- Video, image, legacy DOC, and linked-video contents are not extracted or transcribed.
- Gemini availability and free-tier quota depend on the configured Google AI project.
- Gemini failures return a bounded, safe General AI Tutor error without exposing course content.

## Tests

```bash
cd chatbot-service
source venv/bin/activate
python3 -m unittest discover -s tests -v

cd ../backend
npm run check
npm test

cd ../frontend
npm test
npm run lint
npm run build
```

See [docs/PRODUCTION.md](docs/PRODUCTION.md) for deployment guidance.
