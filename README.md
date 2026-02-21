# 📚 Book Recommender

Personalized book recommendations powered by your Goodreads reading history, Google Books, and an LLM of your choice (OpenAI, Anthropic, or Google Gemini).

---

## Features

- **Two-entry-point home screen** — Get Recommendations or manage My Library & Ratings
- Upload your Goodreads CSV export → get 5 personalized picks per batch
- Optional genre mood filter ("I feel like reading cozy mystery tonight")
- At least 2 recommendations are always by authors new to you
- Refresh for a completely different set of 5 books (no repeats across batches)
- Rate any recommended book → saved to your library → improves future recs
- Manually add any book + rating + read status (Read / Currently Reading / Want to Read)
- Live Google Books search when adding books manually
- Re-upload updated Goodreads CSV at any time (merges cleanly, preserves manual ratings)
- All data stored in browser `localStorage` — no account or database needed

---

## Prerequisites

| Tool | Version |
|---|---|
| Python | 3.10 or higher |
| Node.js | 18 or higher |
| npm | 9 or higher (bundled with Node.js) |

### API Keys needed

You need **at least one LLM key** and the **Google Books key**:

| Key | Where to get it | Required? |
|---|---|---|
| `OPENAI_API_KEY` | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) | One of the three LLM keys |
| `ANTHROPIC_API_KEY` | [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys) | One of the three LLM keys |
| `GEMINI_API_KEY` | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) | One of the three LLM keys |
| `GOOGLE_BOOKS_API_KEY` | [console.cloud.google.com](https://console.cloud.google.com/) → Enable **Books API** → Credentials | Recommended (app works without it but falls back to LLM-only mode) |

---

## Setup

### 1. Clone the repo

```bash
git clone <your-repo-url>
cd book-recommender
```

### 2. Backend

```bash
cd backend

# Create and activate a Python virtual environment
python3 -m venv venv
source venv/bin/activate        # macOS / Linux
# venv\Scripts\activate         # Windows

# Install dependencies
pip install -r requirements.txt

# Copy the example env file and fill in your keys
cp .env.example .env
```

Open `backend/.env` in a text editor and fill in your API keys (see **Configuration** below), then start the server:

```bash
uvicorn main:app --reload --port 8000
```

The backend will be running at **http://localhost:8000**. You can verify it with:

```bash
curl http://localhost:8000/api/health
# → {"status":"ok"}
```

### 3. Frontend

In a **new terminal tab**:

```bash
cd frontend
npm install
npm run dev
```

The app will open at **http://localhost:5173**.

---

## Configuration (`backend/.env`)

Copy `backend/.env.example` to `backend/.env` and fill in the values:

```env
# ── LLM Provider ──────────────────────────────────────────────
# Set LLM_PROVIDER to one of: openai | anthropic | gemini
LLM_PROVIDER=gemini

# Fill in the key for whichever provider you chose (others can be left blank)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=AIza...

# ── Google Books API ───────────────────────────────────────────
# Free — enable "Books API" in Google Cloud Console, then create an API key
# If omitted, the app skips book search and uses LLM knowledge only
GOOGLE_BOOKS_API_KEY=AIza...

# ── CORS ──────────────────────────────────────────────────────
# Must match the address where the frontend runs (default Vite port is 5173)
CORS_ORIGINS=["http://localhost:5173"]
```

### Gemini model selection

When `LLM_PROVIDER=gemini`, the backend automatically lists your available Gemini models at startup, probes for quota, and picks the best available one — no manual model name needed.

---

## Exporting from Goodreads

1. Go to [goodreads.com](https://www.goodreads.com) → **My Books**
2. Click **Import and Export** in the left sidebar
3. Click **Export Library** and wait for the email / download link
4. Upload the downloaded CSV in the app (Get Recommendations page or My Library → Update CSV)

---

## How Recommendations Work

1. Your rated books are sent to an LLM which builds a taste profile (genres, themes, writing styles, loved authors, disliked elements)
2. The LLM generates Google Books search queries targeting both familiar styles and new-to-you authors
3. ~40 candidate books are fetched from Google Books, excluding anything already read or shown
4. A second LLM call ranks the candidates and selects the top 5, writing personalized explanations citing your reading history
5. At least 2 of the 5 are always by authors you haven't read before (`is_new_author: true`)

If no Google Books API key is configured, step 2–3 are skipped and the LLM generates recommendations from its own knowledge.

---

## Data Storage

Everything lives in your browser's `localStorage` — nothing is sent to any server except the LLM/Books API calls:

| Key | Contents |
|---|---|
| `bookStore` | All books (Goodreads CSV + manually added + rated recommendations), keyed by `"title::author"` |
| `shownBookIds` | Google Books IDs already shown, so refresh batches never repeat books |

Re-uploading a Goodreads CSV merges cleanly: CSV data is treated as authoritative for any book that appears in both the CSV and your local edits.

---

## Project Structure

```
book-recommender/
├── backend/
│   ├── main.py                  # FastAPI app entry point
│   ├── config.py                # Settings from .env
│   ├── requirements.txt
│   ├── .env.example             # Template — copy to .env and fill in keys
│   ├── models/schemas.py        # Pydantic request/response models
│   ├── routers/
│   │   ├── recommend.py         # POST /api/recommend
│   │   └── books.py             # GET  /api/books/search
│   └── services/
│       ├── google_books.py      # Google Books API client
│       ├── llm_client.py        # OpenAI / Anthropic / Gemini dispatch
│       └── recommender.py       # Preference extraction + ranking logic
│
└── frontend/
    └── src/
        ├── App.tsx              # Page router (landing | recommender | library)
        ├── types/index.ts       # Shared TypeScript types
        ├── api/client.ts        # fetch wrappers for backend API
        ├── utils/
        │   ├── csvParser.ts     # PapaParse Goodreads CSV → BookEntry[]
        │   └── storage.ts       # localStorage read/write helpers
        ├── pages/
        │   ├── LandingPage.tsx
        │   ├── RecommenderPage.tsx
        │   └── LibraryPage.tsx
        └── components/
            ├── BookTable.tsx
            ├── AddBookForm.tsx
            ├── RecommendationCard.tsx
            ├── RecommendationList.tsx
            ├── StarRating.tsx
            ├── UploadStep.tsx
            └── RatingNudge.tsx
```

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `ModuleNotFoundError` on backend start | Make sure the venv is activated (`source venv/bin/activate`) and `pip install -r requirements.txt` was run |
| `CORS error` in browser console | Check that `CORS_ORIGINS` in `.env` matches exactly where the frontend is running (default `http://localhost:5173`) |
| Recommendations fail with quota error | The app auto-probes for the best available Gemini model; if all quota is exhausted try switching `LLM_PROVIDER` to `openai` or `anthropic` |
| Book search not working in "Add New Book" | Add a valid `GOOGLE_BOOKS_API_KEY` to `.env` and restart the backend |
| Frontend shows blank page | Run `npm install` in the `frontend/` directory, then `npm run dev` |
