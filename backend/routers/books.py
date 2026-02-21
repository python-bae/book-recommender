import logging

from fastapi import APIRouter, HTTPException, Query

from services.google_books import search_books

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/books/search")
async def search(q: str = Query(..., min_length=2)):
    """Search Google Books by title/author query. Returns up to 8 results."""
    logger.info(f"Book search: {q!r}")
    try:
        results = await search_books(q, max_results=8)
    except Exception as e:
        logger.error(f"Google Books search failed: {e}")
        raise HTTPException(status_code=502, detail="Book search failed. Try again.")
    return results
