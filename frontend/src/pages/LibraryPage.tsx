import { useState } from 'react'
import { UploadStep } from '../components/UploadStep'
import { AddBookForm } from '../components/AddBookForm'
import { BookTable } from '../components/BookTable'
import { StarRating } from '../components/StarRating'
import { parseGoodreadsCSV } from '../utils/csvParser'
import { mergeBooks, upsertBook, getAllBooks } from '../utils/storage'
import type { BookEntry, Page } from '../types'

interface Props {
  books: BookEntry[]
  onNavigate: (page: Page) => void
  onLibraryUpdate: () => void
}

type ActiveSection = 'rate' | 'add' | 'upload'

export function LibraryPage({ books, onNavigate, onLibraryUpdate }: Props) {
  const [activeSection, setActiveSection] = useState<ActiveSection>('rate')
  const [csvLoading, setCsvLoading] = useState(false)
  const [mergeResult, setMergeResult] = useState<{ total: number; updated: number } | null>(null)
  const [csvError, setCsvError] = useState('')

  // After adding/rating a book, highlight it in the table
  const [lastAddedTitle, setLastAddedTitle] = useState<string | undefined>(undefined)

  function flashHighlight(title: string) {
    setLastAddedTitle(title)
    // Clear the highlight after 4 seconds so the table search can be cleared freely
    setTimeout(() => setLastAddedTitle(undefined), 4000)
  }

  // Rate section state
  const [rateQuery, setRateQuery] = useState('')
  const [rateRating, setRateRating] = useState(0)
  const [rateSaved, setRateSaved] = useState(false)

  const matched = rateQuery.trim().length >= 2
    ? getAllBooks().find(
        b =>
          b.title.toLowerCase().includes(rateQuery.toLowerCase()) ||
          b.author.toLowerCase().includes(rateQuery.toLowerCase())
      )
    : undefined

  function handleRateSave() {
    const title = matched?.title ?? rateQuery.trim()
    const author = matched?.author ?? ''
    if (!title) { alert('Enter a book title.'); return }
    if (rateRating === 0) { alert('Select a rating.'); return }
    upsertBook({
      title,
      author,
      rating: rateRating,
      shelf: matched?.shelf ?? 'read',
      review: matched?.review,
      bookshelves: matched?.bookshelves,
      isbn: matched?.isbn,
      source: 'recommended',
    })
    onLibraryUpdate()
    flashHighlight(title)
    setRateQuery('')
    setRateRating(0)
    setRateSaved(true)
    setTimeout(() => setRateSaved(false), 2500)
  }

  function handleAddBook(title: string, author: string, rating: number, genre: string, shelf: string) {
    upsertBook({ title, author, rating, genre: genre || undefined, shelf, source: 'manual' })
    onLibraryUpdate()
    flashHighlight(title)
  }

  async function handleCsvUpload(file: File) {
    setCsvLoading(true)
    setCsvError('')
    setMergeResult(null)
    try {
      const parsed = await parseGoodreadsCSV(file)
      const result = mergeBooks(parsed)
      setMergeResult(result)
      onLibraryUpdate()
    } catch (e: unknown) {
      setCsvError(e instanceof Error ? e.message : 'Failed to parse CSV')
    } finally {
      setCsvLoading(false)
    }
  }

  function handleRatingChange(book: BookEntry, newRating: number) {
    upsertBook({ ...book, rating: newRating })
    onLibraryUpdate()
  }

  const tabs: { id: ActiveSection; label: string }[] = [
    { id: 'rate', label: 'Rate a Book' },
    { id: 'add', label: 'Add New Book' },
    { id: 'upload', label: 'Update CSV' },
  ]

  return (
    <div className="page">
      <div className="page-nav">
        <button className="btn btn-ghost" onClick={() => onNavigate('landing')}>
          ← Home
        </button>
      </div>

      <h1 className="page-title">My Library & Ratings</h1>
      <p className="page-desc">
        All changes here feed into your next round of recommendations.
      </p>

      {/* Tabs */}
      <div className="tabs">
        {tabs.map(t => (
          <button
            key={t.id}
            className={`tab${activeSection === t.id ? ' tab-active' : ''}`}
            onClick={() => setActiveSection(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Rate a Book */}
      {activeSection === 'rate' && (
        <div className="section">
          <h2 className="section-title">Rate a Book</h2>
          <p className="section-desc">
            Search for a book in your library or type a new title to rate it.
            Updating a rating for an existing book overwrites the previous one.
          </p>
          <div className="rate-search">
            <input
              className="form-input"
              type="text"
              value={rateQuery}
              onChange={e => { setRateQuery(e.target.value); setRateRating(0) }}
              placeholder="Search by title or author..."
            />
            {matched && (
              <div className="rate-match">
                <span className="rate-match-title">{matched.title}</span>
                <span className="rate-match-author"> by {matched.author}</span>
                {matched.rating > 0 && (
                  <span className="rate-current">
                    &nbsp;— current: <StarRating value={matched.rating} onChange={() => {}} readOnly size="sm" />
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="rate-stars-row">
            <span className="form-label">New rating:</span>
            <StarRating value={rateRating} onChange={setRateRating} size="lg" />
          </div>

          <div className="form-row">
            <button
              className="btn btn-primary"
              onClick={handleRateSave}
              disabled={rateRating === 0}
            >
              Save Rating
            </button>
            {rateSaved && <span className="save-toast">Rating saved!</span>}
          </div>
        </div>
      )}

      {/* Add New Book */}
      {activeSection === 'add' && (
        <div className="section">
          <h2 className="section-title">Add a New Book</h2>
          <p className="section-desc">
            Manually add a book and rating. If it already exists in your library,
            the rating will be updated.
          </p>
          <AddBookForm onSave={handleAddBook} />
        </div>
      )}

      {/* Update CSV */}
      {activeSection === 'upload' && (
        <div className="section">
          <h2 className="section-title">Update Goodreads CSV</h2>
          <p className="section-desc">
            Re-upload an updated Goodreads export. Books already in your library
            will have their data updated. Manually added books and ratings are
            preserved unless the CSV also contains that book.
          </p>
          <UploadStep
            onFile={handleCsvUpload}
            loading={csvLoading}
            label="Drop updated Goodreads CSV here, or click to browse"
          />
          {mergeResult && (
            <div className="merge-result success">
              Merged {mergeResult.total} books total &middot; {mergeResult.updated} rating{mergeResult.updated !== 1 ? 's' : ''} updated.
            </div>
          )}
          {csvError && <div className="merge-result error">{csvError}</div>}
        </div>
      )}

      {/* Book Table */}
      <div className="section">
        <h2 className="section-title">
          All Books <span className="section-count">({books.length})</span>
        </h2>
        {books.length === 0 ? (
          <p className="empty-state">
            No books yet. Upload a Goodreads CSV or add books manually above.
          </p>
        ) : (
          <BookTable
            books={books}
            onRatingChange={handleRatingChange}
            highlightTitle={lastAddedTitle}
          />
        )}
      </div>
    </div>
  )
}
