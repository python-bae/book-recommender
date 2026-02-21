export interface BookEntry {
  book_key: string
  title: string
  author: string
  rating: number        // 0 = unrated; 1-5 = rated
  shelf: string         // "read" | "to-read" | "currently-reading" | "manual"
  genre?: string        // e.g. "Fiction", "Science Fiction", from Google Books categories
  review?: string
  bookshelves?: string
  isbn?: string
  source: 'goodreads' | 'manual' | 'recommended'
  date_updated: string  // ISO date string
}

export interface Recommendation {
  title: string
  author: string
  description: string
  cover_url?: string
  google_books_id: string
  genre: string
  reason: string
  predicted_rating: number
  is_new_author: boolean
}

export interface RecommendResponse {
  recommendations: Recommendation[]
  preference_summary: string
}

export type Page = 'landing' | 'recommender' | 'library'

export interface BookSearchResult {
  google_books_id: string
  title: string
  author: string
  description: string
  cover_url?: string
  published_date?: string
  categories?: string[]   // Google Books genre categories
}
