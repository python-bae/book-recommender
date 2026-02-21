import { useState, useEffect, useRef } from 'react'
import { StarRating } from './StarRating'
import { searchBooks } from '../api/client'
import type { BookSearchResult } from '../types'

const SHELF_OPTIONS = [
  { value: 'read',               label: 'Read' },
  { value: 'currently-reading',  label: 'Currently Reading' },
  { value: 'to-read',            label: 'Want to Read' },
]

interface Props {
  onSave: (title: string, author: string, rating: number, genre: string, shelf: string) => void
}

export function AddBookForm({ onSave }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<BookSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<BookSearchResult | null>(null)
  const [rating, setRating] = useState(0)
  const [shelf, setShelf] = useState('read')
  const [saved, setSaved] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Debounced search — fires 400ms after user stops typing
  useEffect(() => {
    if (selected) return
    if (query.trim().length < 2) {
      setResults([])
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const hits = await searchBooks(query.trim())
        setResults(hits)
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 400)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, selected])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setResults([])
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleSelect(book: BookSearchResult) {
    setSelected(book)
    setQuery(`${book.title} — ${book.author}`)
    setResults([])
  }

  function handleClear() {
    setSelected(null)
    setQuery('')
    setResults([])
    setRating(0)
    setShelf('read')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const title = selected?.title ?? query.trim()
    const author = selected?.author ?? ''
    const genre = selected?.categories?.[0] ?? ''
    if (!title) { alert('Please search for a book first.'); return }
    if (rating === 0) { alert('Please select a rating.'); return }
    onSave(title, author, rating, genre, shelf)
    handleClear()
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <form className="add-book-form" onSubmit={handleSubmit}>

      {/* Search input + dropdown */}
      <div className="form-row">
        <label className="form-label" style={{ flex: 1 }}>
          Search for a book
          <div className="book-search-wrap" ref={dropdownRef}>
            <div className="book-search-input-row">
              <input
                className="form-input"
                type="text"
                value={query}
                onChange={e => { setQuery(e.target.value); setSelected(null) }}
                placeholder="Search by title or author..."
                autoComplete="off"
              />
              {(query || selected) && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={handleClear}
                  title="Clear"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Dropdown results */}
            {!selected && (results.length > 0 || searching) && (
              <div className="book-search-dropdown">
                {searching && <div className="book-search-status">Searching…</div>}
                {!searching && results.length === 0 && (
                  <div className="book-search-status">No results found.</div>
                )}
                {results.map(book => (
                  <button
                    key={book.google_books_id}
                    type="button"
                    className="book-search-result"
                    onClick={() => handleSelect(book)}
                  >
                    {book.cover_url
                      ? <img src={book.cover_url} alt={book.title} className="book-search-cover" />
                      : <div className="book-search-cover book-search-cover-placeholder">📖</div>
                    }
                    <div className="book-search-info">
                      <span className="book-search-title">{book.title}</span>
                      <span className="book-search-author">{book.author}</span>
                      <div className="book-search-meta">
                        {book.published_date && (
                          <span className="book-search-year">{book.published_date.slice(0, 4)}</span>
                        )}
                        {book.categories?.[0] && (
                          <span className="book-search-genre">{book.categories[0]}</span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </label>
      </div>

      {/* Selected book preview */}
      {selected && (
        <div className="book-selected-preview">
          {selected.cover_url
            ? <img src={selected.cover_url} alt={selected.title} className="book-selected-cover" />
            : <div className="book-selected-cover book-search-cover-placeholder">📖</div>
          }
          <div className="book-selected-info">
            <div className="book-selected-title">{selected.title}</div>
            <div className="book-selected-author">{selected.author}</div>
            <div className="book-selected-meta">
              {selected.published_date && (
                <span className="book-selected-year">{selected.published_date.slice(0, 4)}</span>
              )}
              {selected.categories?.[0] && (
                <span className="book-selected-genre">{selected.categories[0]}</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Shelf + Rating row */}
      <div className="form-row add-book-controls">
        <div className="shelf-select-wrap">
          <span className="form-label">Read status</span>
          <div className="shelf-buttons">
            {SHELF_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                className={`shelf-btn${shelf === opt.value ? ' shelf-btn-active' : ''}`}
                onClick={() => setShelf(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="rating-wrap">
          <span className="form-label">Your rating</span>
          <StarRating value={rating} onChange={setRating} size="lg" />
        </div>
      </div>

      <div className="form-row">
        <button className="btn btn-primary" type="submit" disabled={rating === 0}>
          Add to My Library
        </button>
        {saved && <span className="save-toast">Saved!</span>}
      </div>
    </form>
  )
}
