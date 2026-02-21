import logging
import traceback

from fastapi import APIRouter, HTTPException

from models.schemas import RecommendRequest, RecommendResponse
from services.recommender import generate_recommendations

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/recommend", response_model=RecommendResponse)
async def get_recommendations(req: RecommendRequest):
    rated_books = [b for b in req.read_books if b.rating >= 1]
    logger.info(f"Recommendation request: {len(rated_books)} rated books, genre_mood={req.genre_mood!r}, exclude_ids={len(req.exclude_book_ids)}")

    if len(rated_books) < 3:
        raise HTTPException(
            status_code=422,
            detail="Need at least 3 rated books to generate recommendations. "
                   "Add more ratings in My Library & Ratings.",
        )

    try:
        result = await generate_recommendations(
            books=rated_books,
            genre_mood=req.genre_mood or None,
            exclude_book_ids=req.exclude_book_ids,
            count=req.count,
        )
    except ValueError as e:
        logger.error(f"AI response parse error:\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"AI response error: {e}. Please try again.")
    except Exception as e:
        logger.error(f"Recommendation failed:\n{traceback.format_exc()}")
        raise HTTPException(status_code=502, detail=str(e))

    logger.info(f"Recommendation success: returned {len(result['recommendations'])} books")
    return RecommendResponse(
        recommendations=result["recommendations"],
        preference_summary=result["preference_summary"],
    )
