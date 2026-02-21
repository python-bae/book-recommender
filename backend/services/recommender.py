import json
import logging
import traceback
import uuid
from typing import List, Dict, Any, Optional

from services.llm_client import complete
from services.google_books import fetch_candidates
from models.schemas import BookInput, Recommendation
from config import settings

logger = logging.getLogger(__name__)

PREFERENCE_SYSTEM_PROMPT = """You are a literary analyst helping to understand a reader's taste.
You will receive a list of books a person has read, with their personal ratings (1-5 stars).
Analyze the patterns and return a JSON object with these exact keys:
{
  "summary": "2-3 sentence human-readable description of their taste",
  "genres": ["list of genres/subgenres they enjoy"],
  "themes": ["recurring themes: e.g. found family, political intrigue, grief, coming of age"],
  "writing_styles": ["preferences: e.g. lyrical prose, fast-paced plotting, unreliable narrator"],
  "loved_authors": ["authors they rated highly (4-5 stars)"],
  "disliked_elements": ["patterns from low-rated books (1-2 stars)"],
  "google_books_queries": ["4-6 search queries to find similar books, using subject: and inauthor: prefixes. At least half should target authors NOT in the user's read list."]
}
If a genre_mood is provided in the user message, heavily weight that genre in google_books_queries.
Pay particular attention to 4-5 star books when forming the taste profile.
Only return valid JSON — no markdown fences, no text before or after."""

RANKING_SYSTEM_PROMPT = """You are a personal book recommender.
You will receive:
1. A reader's taste profile (JSON)
2. A list of candidate books (JSON array) from Google Books
3. The target count of recommendations

Return a JSON array of exactly the target count of most suitable books, ordered best-to-worst match.
Each object must have these exact keys:
{
  "google_books_id": "...",
  "genre": "e.g. Hard Science Fiction, Gothic Fantasy, Cozy Mystery",
  "reason": "2-3 sentence explanation referencing specific books from the user's history by title",
  "predicted_rating": 4.2,
  "is_new_author": true
}
Rules:
- Only include books from the candidates list (no hallucinated titles)
- At least 2 books MUST be by authors NOT in the user's loved_authors or read list (mark these is_new_author: true)
- Reason must be personalized and cite specific titles from the user's reading history
- predicted_rating is a float 1.0-5.0 estimating how much this reader will enjoy it
Only return valid JSON array — no markdown fences, no text before or after."""

# Used when Google Books API key is not configured — LLM generates books from scratch
LLM_ONLY_SYSTEM_PROMPT = """You are a personal book recommender.
You will receive a reader's taste profile (JSON) and a target count.

Since no external book database is available, recommend real, well-known books entirely from your knowledge.
Return a JSON array of exactly the target count of books, ordered best-to-worst match.
Each object must have these exact keys:
{
  "title": "exact book title",
  "author": "author full name",
  "genre": "e.g. Hard Science Fiction, Gothic Fantasy, Cozy Mystery",
  "description": "2-3 sentence plot summary",
  "reason": "2-3 sentence explanation referencing specific books from the user's history by title",
  "predicted_rating": 4.2,
  "is_new_author": true
}
Rules:
- Only recommend real published books you are confident exist
- At least 2 must be by authors NOT in the user's loved_authors or read list (mark is_new_author: true)
- Do NOT recommend any book already in the user's read list
- Reason must be personalized and cite specific titles from the user's history
- predicted_rating is a float 1.0-5.0 estimating enjoyment
Only return valid JSON array — no markdown fences, no text before or after."""


def _build_preference_prompt(books: List[BookInput], genre_mood: Optional[str]) -> str:
    lines = []
    for b in books:
        rating_str = f"{b.rating}/5"
        review_str = f' | Review snippet: "{b.review[:120]}..."' if b.review else ""
        shelves_str = f" | Shelves: {b.bookshelves}" if b.bookshelves else ""
        lines.append(f"- {b.title} by {b.author} [{rating_str}]{review_str}{shelves_str}")

    prompt = "Books I have read:\n" + "\n".join(lines)
    if genre_mood:
        prompt += f"\n\nGenre mood: The user currently feels like reading: {genre_mood}"
    return prompt


def _build_ranking_prompt(preferences: Dict[str, Any], candidates: List[Dict[str, Any]], count: int) -> str:
    candidate_summaries = []
    for c in candidates:
        candidate_summaries.append({
            "google_books_id": c["google_books_id"],
            "title": c["title"],
            "author": c["author"],
            "description": (c.get("description") or "")[:150],
            "categories": c.get("categories", []),
        })
    return (
        f"Reader preferences:\n{json.dumps(preferences, indent=2)}\n\n"
        f"Target recommendation count: {count}\n\n"
        f"Candidate books:\n{json.dumps(candidate_summaries, indent=2)}"
    )


def _strip_fences(raw: str) -> str:
    """Remove accidental markdown code fences that LLMs sometimes add."""
    return raw.strip().lstrip("```json").lstrip("```").rstrip("```").strip()


def _parse_json_resilient(raw: str, label: str) -> Any:
    """Parse JSON, with a recovery attempt if the response was truncated.

    If the response is cut off mid-JSON the LLM hit its token limit.  We try
    to salvage whatever complete objects were returned before the truncation.
    """
    cleaned = _strip_fences(raw)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as e:
        logger.warning(f"{label}: JSON parse failed ({e}) — attempting truncation recovery")

    # Recovery: for arrays, grab every complete {...} object before the cut-off
    if cleaned.lstrip().startswith("["):
        recovered = []
        depth = 0
        obj_start = None
        for i, ch in enumerate(cleaned):
            if ch == "{":
                if depth == 0:
                    obj_start = i
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0 and obj_start is not None:
                    try:
                        obj = json.loads(cleaned[obj_start:i + 1])
                        recovered.append(obj)
                    except json.JSONDecodeError:
                        pass
                    obj_start = None
        if recovered:
            logger.warning(f"{label}: recovered {len(recovered)} complete object(s) from truncated response")
            return recovered

    # Recovery: for objects, try closing the JSON at the last complete key-value pair
    if cleaned.lstrip().startswith("{"):
        # Walk backwards to find the last complete comma-separated entry
        for i in range(len(cleaned) - 1, 0, -1):
            candidate = cleaned[:i].rstrip().rstrip(",") + "\n}"
            try:
                return json.loads(candidate)
            except json.JSONDecodeError:
                continue

    # No recovery possible — re-raise with the original error context
    logger.error(f"{label}: could not recover truncated JSON. Raw response:\n{raw}")
    raise ValueError(
        f"AI response was cut off before it finished (token limit hit). "
        f"Raw snippet: {raw[:120]}..."
    )


async def _llm_only_recommendations(
    preferences: Dict[str, Any],
    books: List[BookInput],
    exclude_book_ids: List[str],
    count: int,
) -> List[Recommendation]:
    """Generate recommendations purely from LLM knowledge — no Google Books needed."""
    exclude_titles = {b.title.lower().strip() for b in books}
    known_authors = {b.author.lower().strip() for b in books}

    llm_prompt = (
        f"Reader preferences:\n{json.dumps(preferences, indent=2)}\n\n"
        f"Books to EXCLUDE (already read):\n"
        + "\n".join(f"- {b.title} by {b.author}" for b in books)
        + f"\n\nTarget recommendation count: {count}"
    )

    logger.info("LLM-only mode: calling LLM to generate recommendations from knowledge")
    ranking_raw = await complete(LLM_ONLY_SYSTEM_PROMPT, llm_prompt)
    logger.debug(f"LLM-only raw response:\n{ranking_raw}")
    try:
        rankings: List[Dict[str, Any]] = _parse_json_resilient(ranking_raw, "LLM-only ranking")
    except (json.JSONDecodeError, ValueError) as e:
        logger.error(f"Failed to parse LLM-only response as JSON. Error: {e}\nRaw response:\n{ranking_raw}")
        raise

    final: List[Recommendation] = []
    seen_ids: set = set(exclude_book_ids)

    for item in rankings:
        title = item.get("title", "").strip()
        author = item.get("author", "").strip()
        if not title or title.lower() in exclude_titles:
            continue

        # Assign a stable synthetic ID so the frontend can track shown books
        synthetic_id = f"llm-{uuid.uuid5(uuid.NAMESPACE_DNS, f'{title}::{author}')}"
        if synthetic_id in seen_ids:
            continue
        seen_ids.add(synthetic_id)

        is_new = author.lower() not in known_authors
        final.append(Recommendation(
            title=title,
            author=author,
            description=item.get("description", ""),
            cover_url=None,          # no cover without Google Books
            google_books_id=synthetic_id,
            genre=item.get("genre", "Fiction"),
            reason=item.get("reason", ""),
            predicted_rating=float(item.get("predicted_rating", 3.5)),
            is_new_author=item.get("is_new_author", is_new),
        ))
        if len(final) >= count:
            break

    return final


async def generate_recommendations(
    books: List[BookInput],
    genre_mood: Optional[str],
    exclude_book_ids: List[str],
    count: int = 5,
) -> Dict[str, Any]:
    # Step 1: Extract preference profile (always runs)
    logger.info(f"Step 1: Extracting preference profile from {len(books)} rated books")
    pref_raw = await complete(PREFERENCE_SYSTEM_PROMPT, _build_preference_prompt(books, genre_mood))
    logger.debug(f"Preference LLM raw response:\n{pref_raw}")
    try:
        preferences = _parse_json_resilient(pref_raw, "preference profile")
    except (json.JSONDecodeError, ValueError) as e:
        logger.error(f"Failed to parse preference profile as JSON. Error: {e}\nRaw response:\n{pref_raw}")
        raise

    logger.info(f"Preference profile extracted. Genres: {preferences.get('genres')}, Queries: {preferences.get('google_books_queries')}")

    known_authors = {b.author.lower().strip() for b in books}

    # Step 2: Decide path — Google Books + LLM ranking, or LLM-only
    use_google_books = bool(settings.google_books_api_key)
    logger.info(f"Step 2: {'Using Google Books API' if use_google_books else 'No Google Books API key — using LLM-only mode'}")

    if use_google_books:
        genre_queries: List[str] = preferences.get("google_books_queries", [])[:5]
        loved_authors: List[str] = preferences.get("loved_authors", [])
        author_queries = [f"inauthor:{a}" for a in loved_authors[:2]]
        exclude_titles = {b.title.lower().strip() for b in books}
        exclude_id_set = set(exclude_book_ids)

        logger.info(f"Fetching candidates with queries: {genre_queries + author_queries}")
        try:
            candidates = await fetch_candidates(genre_queries, author_queries, exclude_titles, target_count=50)
        except Exception as e:
            logger.error(f"Google Books fetch failed:\n{traceback.format_exc()}")
            raise
        candidates = [c for c in candidates if c["google_books_id"] not in exclude_id_set]
        logger.info(f"Google Books returned {len(candidates)} candidates after filtering")

        if candidates:
            # Step 3a: Rank candidates with LLM
            logger.info("Step 3a: Ranking candidates with LLM")
            ranking_raw = await complete(RANKING_SYSTEM_PROMPT, _build_ranking_prompt(preferences, candidates, count))
            logger.debug(f"Ranking LLM raw response:\n{ranking_raw}")
            try:
                rankings: List[Dict[str, Any]] = _parse_json_resilient(ranking_raw, "candidate ranking")
            except (json.JSONDecodeError, ValueError) as e:
                logger.error(f"Failed to parse ranking response as JSON. Error: {e}\nRaw response:\n{ranking_raw}")
                raise

            candidate_map = {c["google_books_id"]: c for c in candidates}
            final: List[Recommendation] = []
            for rank_item in rankings:
                gid = rank_item.get("google_books_id", "")
                if gid not in candidate_map:
                    logger.warning(f"LLM returned unknown google_books_id '{gid}' — skipping")
                    continue
                c = candidate_map[gid]
                is_new = c["author"].lower().strip() not in known_authors
                final.append(Recommendation(
                    title=c["title"],
                    author=c["author"],
                    description=c.get("description") or "",
                    cover_url=c.get("cover_url"),
                    google_books_id=gid,
                    genre=rank_item.get("genre", "Fiction"),
                    reason=rank_item.get("reason", ""),
                    predicted_rating=float(rank_item.get("predicted_rating", 3.5)),
                    is_new_author=rank_item.get("is_new_author", is_new),
                ))
                if len(final) >= count:
                    break
            logger.info(f"Final recommendation list: {[r.title for r in final]}")
        else:
            logger.warning("Google Books returned 0 usable candidates — falling back to LLM-only mode")
            final = await _llm_only_recommendations(preferences, books, exclude_book_ids, count)
    else:
        # Step 3b: No API key — generate entirely from LLM knowledge
        logger.info("Step 3b: LLM-only mode")
        final = await _llm_only_recommendations(preferences, books, exclude_book_ids, count)

    return {
        "recommendations": final,
        "preference_summary": preferences.get("summary", ""),
    }
