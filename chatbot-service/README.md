# EDUNova General AI Tutor service

This private Flask service sends general educational questions and bounded same-user conversation context to Gemini. It has no database credentials or user-authentication logic; Express authenticates users, scopes history, and keeps the Gemini key server-side.

`POST /chat` accepts only `mode: "general"`. Course mode and course-specific fields such as `courseId`, `lessonId`, `documents`, `sources`, and `followUp` are rejected. Answers use general knowledge and are not verified against EDUNova course materials.

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Create `.env` from `.env.example`, add the key locally, then start Flask with `python3 chatbot.py` while the virtual environment is active.

```env
AI_PROVIDER=gemini
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.6-flash
GEMINI_TIMEOUT_SECONDS=60
GEMINI_MAX_OUTPUT_TOKENS=1600
GEMINI_MAX_ANSWER_LENGTH=8000
```

Generated output is bounded and trimmed at a complete sentence boundary. Missing configuration, quota exhaustion, timeouts, blocked or malformed responses, and network failures return categorized safe errors without course content.

The service listens on `127.0.0.1:5001` by default. `GET /health` reports provider/configuration availability without exposing the key. Keep `POST /chat` private and accessible only from Express.

```json
{"mode":"general","message":"What is Python?","conversation":[]}
```

The old TF-IDF implementation and `scikit-learn` dependency remain dormant for Phase 1 compatibility. They are not reachable from `/chat` and are scheduled for Phase 2 removal.
