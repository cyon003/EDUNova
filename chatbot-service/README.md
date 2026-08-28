# EDUNova Course Assistant service

This private Flask service performs TF-IDF/cosine-similarity retrieval over documents supplied by the trusted Express API, then asks Gemini to explain only the highest-ranking authorized passages. Flask has no database credentials or user authentication logic; its Gemini key remains server-side.

`POST /chat` requires an explicit `mode`. Course mode accepts only Express-authorized documents and applies TF-IDF before Gemini. General mode rejects course documents and follow-up metadata, skips retrieval entirely, and sends only the question plus bounded general-mode conversation context. General failures return a fixed unavailable message and never use an extractive course fallback.

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Create `.env` from `.env.example`, add the key locally, then start Flask with `python3 chatbot.py` while the virtual environment is active.

Configure the service through its local `.env` file or process environment:

```bash
AI_PROVIDER=gemini
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.6-flash
GEMINI_TIMEOUT_SECONDS=60
GEMINI_MAX_OUTPUT_TOKENS=1600
GEMINI_MAX_ANSWER_LENGTH=8000
```

The relevance gate runs before generation. Short referential follow-ups are resolved by Express from the latest successful turn in the exact user/course/lesson scope, then still pass through TF-IDF. Low-relevance questions never reach Gemini. If Gemini is unavailable, slow, quota-limited, blocked, or invalid, the service returns the best retrieved passage as an explicitly marked extractive fallback. Generated output is bounded and trimmed at a complete sentence boundary.

Retrieval normalizes punctuation, case, whitespace, and common technical spelling variants. It extracts the searchable topic from conversational instructions, compares both normalized full-query and topic-query scores, and applies a capped exact-term/phrase bonus. The configured similarity threshold remains the final gate.

It listens on `127.0.0.1:5001` by default. Check `GET /health`; it reports provider/configuration availability without exposing the key. `POST /chat` is intended only for Express, so keep Flask private and do not expose it through the public reverse proxy.

Request examples:

```json
{"mode":"course","message":"Explain authentication","documents":[],"conversation":[],"followUp":{}}
```

```json
{"mode":"general","message":"What is Python?","conversation":[]}
```
