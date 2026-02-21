import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from routers.recommend import router as recommend_router
from routers.books import router as books_router

# Configure logging — prints to the uvicorn terminal with timestamps and level
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)

app = FastAPI(title="Book Recommender API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

app.include_router(recommend_router, prefix="/api")
app.include_router(books_router, prefix="/api")


@app.get("/api/health")
async def health():
    return {"status": "ok"}
