# EDUNova

EDUNova is a React, Express, MongoDB learning platform with student, tutor, and administrator workflows. Its Course Assistant retrieves authorized course passages with a private Python TF-IDF service and uses the Gemini API for grounded explanations.

## Requirements

- Node.js 20 or newer
- MongoDB 7 or newer
- Python 3.10 or newer

## Local setup

Start MongoDB using your normal local installation, for example Homebrew:

```bash
brew services start mongodb-community
```

Start the Python course-assistant service:

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

Open `http://localhost:5173`, sign in, enroll in a published course, then open `/ai-chatbot`. Tutors can search their own courses and administrators can search any course.

## Course Assistant configuration

Express uses these backend environment variables:

```env
PYTHON_CHATBOT_URL=http://127.0.0.1:5001
PYTHON_CHATBOT_TIMEOUT_MS=70000
AI_CHATBOT_RATE_LIMIT_MAX=20
AI_CHATBOT_RATE_LIMIT_WINDOW_MS=60000
AI_COURSE_RATE_LIMIT_PER_MINUTE=20
AI_GENERAL_RATE_LIMIT_PER_MINUTE=5
AI_CHATBOT_MAX_TOTAL_TEXT=100000
AI_CHATBOT_MAX_DOCUMENTS=100
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

Optional retrieval variables include `CHATBOT_HOST`, `CHATBOT_PORT`, `CHATBOT_SIMILARITY_THRESHOLD`, `CHATBOT_MAX_MESSAGE_LENGTH`, `CHATBOT_MAX_DOCUMENT_LENGTH`, `CHATBOT_MAX_TOTAL_CONTENT`, and `CHATBOT_CHUNK_LENGTH`.

Express verifies the JWT, role, course ownership or enrollment, and publication status. It loads permitted course text, lesson text, extracted resource chunks, and a bounded amount of that same user’s recent course conversation from MongoDB. Flask ranks authorized chunks with TF-IDF/cosine similarity. A low score returns the safe fallback without generation. Otherwise Flask sends only the top passages, current question, and bounded recent context to Gemini. Flask—not Gemini—attaches validated chunk metadata, and Express revalidates every source against the authorized documents before saving history.

The AI Assistant has two explicit modes. `course` preserves the grounded retrieval flow above and requires an authorized course. `general` sends only the current question and bounded general-mode history to Gemini, performs no TF-IDF retrieval, and never returns course sources. General answers are clearly labeled as unverified general knowledge. Requests, stored history, history listing, and clearing are isolated by user and mode; course records are additionally isolated by course and lesson.

After introducing assistant modes, run the idempotent migration once for an existing database:

```bash
cd backend
npm run migrate:chatbot-modes
```

This marks legacy assistant conversations as `course`; it does not alter their messages or source metadata.

For short referential follow-ups, Express uses only the latest successful conversation in the exact user, course, and selected-lesson scope. It revalidates the prior source, includes adjacent chunks from the same resource when available, and constructs a standalone retrieval query that must still pass the relevance gate. Internal rewritten queries are never returned to React.

Retrieval separates conversational instructions from technical topics, normalizes spelling variants such as `Next.js`/`Next JS`/`nextjs`, and uses the stronger TF-IDF score from the normalized full query or extracted topic. A bounded exact-topic bonus improves lexical matches without changing the global relevance threshold or allowing unsupported generation. Development-only logs include the resolved topic, selected source, and score.

PDF, DOCX, and TXT lesson resources are extracted locally during upload. PDF.js preserves page numbers, Mammoth reads raw DOCX text, and Node reads TXT files. Normalized bounded chunks are stored in the separate `lessonresourcechunks` MongoDB collection. Tutors can see extraction state and retry failed resources. Extraction failure does not fail lesson creation.

To safely process resources uploaded before this feature, or reprocess all supported resources after changing limits, run:

```bash
cd backend
npm run reprocess:lesson-resources
```

The command is idempotent: chunks are upserted by resource and chunk number, and stale chunks are removed.

Current limitations:

- Retrieval is lexical, so synonyms absent from the material may not pass the relevance gate.
- Course descriptions, lesson titles/descriptions, and extracted PDF/DOCX/TXT text are searchable.
- Scanned/image-only PDFs require OCR and therefore produce a safe failed/empty extraction status.
- Video, image, legacy DOC, and linked-video contents are not extracted or transcribed.
- Gemini availability and free-tier quota depend on the configured Google AI project.
- Gemini failures degrade to a clearly marked retrieved passage; low-relevance questions remain safe fallbacks.

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
