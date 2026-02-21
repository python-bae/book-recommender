import httpx
from typing import List, Dict, Any, Set

from config import settings

GOOGLE_BOOKS_BASE = "https://www.googleapis.com/books/v1/volumes"


async def search_books(query: str, max_results: int = 20) -> List[Dict[str, Any]]:
    params = {
        "q": query,
        "maxResults": max_results,
        "printType": "books",
        "langRestrict": "en",
    }
    if settings.google_books_api_key:
        params["key"] = settings.google_books_api_key

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(GOOGLE_BOOKS_BASE, params=params)
        resp.raise_for_status()

    data = resp.json()
    return _normalize_items(data.get("items", []))


def _normalize_items(items: list) -> List[Dict[str, Any]]:
    results = []
    for item in items:
        info = item.get("volumeInfo", {})
        image_links = info.get("imageLinks", {})
        # Prefer https cover URLs to avoid mixed-content warnings
        cover = image_links.get("thumbnail") or image_links.get("smallThumbnail")
        if cover:
            cover = cover.replace("http://", "https://")
        results.append({
            "google_books_id": item.get("id", ""),
            "title": info.get("title", ""),
            "author": ", ".join(info.get("authors", [])),
            "description": info.get("description", ""),
            "cover_url": cover,
            "categories": info.get("categories", []),
            "average_rating": info.get("averageRating"),
            "published_date": info.get("publishedDate", ""),
        })
    return results


async def fetch_candidates(
    genre_queries: List[str],
    author_queries: List[str],
    exclude_titles: Set[str],
    target_count: int = 40,
) -> List[Dict[str, Any]]:
    seen_ids: Set[str] = set()
    candidates: List[Dict[str, Any]] = []
    all_queries = genre_queries + author_queries

    for query in all_queries:
        if len(candidates) >= target_count:
            break
        try:
            results = await search_books(query, max_results=20)
        except Exception:
            continue

        for book in results:
            bid = book["google_books_id"]
            title_norm = book["title"].lower().strip()
            if bid and bid not in seen_ids and title_norm not in exclude_titles:
                seen_ids.add(bid)
                candidates.append(book)

    return candidates[:target_count]
