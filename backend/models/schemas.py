from pydantic import BaseModel
from typing import Optional, List


class BookInput(BaseModel):
    title: str
    author: str
    rating: int
    shelf: str
    review: Optional[str] = None
    bookshelves: Optional[str] = None
    isbn: Optional[str] = None


class RecommendRequest(BaseModel):
    read_books: List[BookInput]
    genre_mood: Optional[str] = None
    exclude_book_ids: List[str] = []
    count: int = 5


class Recommendation(BaseModel):
    title: str
    author: str
    description: str
    cover_url: Optional[str] = None
    google_books_id: str
    genre: str
    reason: str
    predicted_rating: float
    is_new_author: bool


class RecommendResponse(BaseModel):
    recommendations: List[Recommendation]
    preference_summary: str
