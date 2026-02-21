import type { BookEntry, BookSearchResult, RecommendResponse } from '../types'

const BASE = '/api'

export async function searchBooks(query: string): Promise<BookSearchResult[]> {
  const res = await fetch(`${BASE}/books/search?q=${encodeURIComponent(query)}`)
  if (!res.ok) {
    console.error(`[API] GET /books/search failed — HTTP ${res.status}`)
    return []
  }
  return res.json()
}

export async function getRecommendations(
  ratedBooks: BookEntry[],
  genreMood: string,
  excludeBookIds: string[],
  count = 5,
): Promise<RecommendResponse> {
  const body = {
    read_books: ratedBooks.map(b => ({
      title: b.title,
      author: b.author,
      rating: b.rating,
      shelf: b.shelf,
      review: b.review ?? null,
      bookshelves: b.bookshelves ?? null,
      isbn: b.isbn ?? null,
    })),
    genre_mood: genreMood.trim() || null,
    exclude_book_ids: excludeBookIds,
    count,
  }

  const res = await fetch(`${BASE}/recommend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    let detail = 'Recommendation failed'
    try {
      const err = await res.json()
      detail = err.detail || detail
    } catch {}
    console.error(`[API] POST /recommend failed — HTTP ${res.status}: ${detail}`)
    throw new Error(detail)
  }

  return res.json()
}
