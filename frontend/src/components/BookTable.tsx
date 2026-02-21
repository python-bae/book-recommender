import { useState, useMemo, useEffect } from 'react'
import { StarRating } from './StarRating'
import type { BookEntry } from '../types'

interface Props {
  books: BookEntry[]
  onRatingChange: (book: BookEntry, newRating: number) => void
  /** When set, pre-fills the search box so the user sees the just-added book */
  highlightTitle?: string
}

const SOURCE_LABELS: Record<string, string> = {
  goodreads: 'Goodreads',
  manual: 'Manual',
  recommended: 'Recommended',
}

const SOURCE_CLASSES: Record<string, string> = {
  goodreads: 'badge-goodreads',
  manual: 'badge-manual',
  recommended: 'badge-rec-source',
}

const SHELF_LABELS: Record<string, { label: string; cls: string }> = {
  'read':              { label: 'Read',              cls: 'shelf-read' },
  'currently-reading': { label: 'Reading',           cls: 'shelf-reading' },
  'to-read':           { label: 'Want to Read',      cls: 'shelf-to-read' },
  'manual':            { label: '',                  cls: '' },   // leave blank for manually-added with no shelf
}

export function BookTable({ books, onRatingChange, highlightTitle }: Props) {
  const [search, setSearch] = useState('')
  const [sortCol, setSortCol] = useState<'title' | 'author' | 'rating' | 'date_updated'>('date_updated')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 20

  // When a new book is just saved, pre-fill the search with its title
  // so the user immediately sees it in the table.
  useEffect(() => {
    if (highlightTitle) {
      setSearch(highlightTitle)
      setPage(0)
      setSortCol('date_updated')
      setSortDir('desc')
    }
  }, [highlightTitle])

  function toggleSort(col: typeof sortCol) {
    if (sortCol === col) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortCol(col)
      setSortDir('asc')
    }
    setPage(0)
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return books.filter(
      b =>
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q)
    )
  }, [books, search])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let av: string | number = a[sortCol] ?? ''
      let bv: string | number = b[sortCol] ?? ''
      if (typeof av === 'string') av = av.toLowerCase()
      if (typeof bv === 'string') bv = bv.toLowerCase()
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [filtered, sortCol, sortDir])

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE)
  const visible = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  function SortIndicator({ col }: { col: typeof sortCol }) {
    if (sortCol !== col) return <span className="sort-icon">↕</span>
    return <span className="sort-icon">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  function ShelfBadge({ shelf }: { shelf: string }) {
    const info = SHELF_LABELS[shelf]
    if (!info || !info.label) return null
    return <span className={`shelf-badge ${info.cls}`}>{info.label}</span>
  }

  return (
    <div className="book-table-wrap">
      <div className="book-table-toolbar">
        <input
          className="form-input search-input"
          type="search"
          placeholder="Search by title or author..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(0) }}
        />
        <span className="book-count">{filtered.length} book{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {visible.length === 0 ? (
        <p className="empty-state">No books found.</p>
      ) : (
        <div className="table-scroll">
          <table className="book-table">
            <thead>
              <tr>
                <th onClick={() => toggleSort('title')} className="sortable">
                  Title <SortIndicator col="title" />
                </th>
                <th onClick={() => toggleSort('author')} className="sortable">
                  Author <SortIndicator col="author" />
                </th>
                <th>Status</th>
                <th onClick={() => toggleSort('rating')} className="sortable">
                  Rating <SortIndicator col="rating" />
                </th>
                <th>Source</th>
                <th onClick={() => toggleSort('date_updated')} className="sortable">
                  Updated <SortIndicator col="date_updated" />
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map(book => (
                <tr
                  key={book.book_key}
                  className={
                    highlightTitle &&
                    book.title.toLowerCase() === highlightTitle.toLowerCase()
                      ? 'row-highlight'
                      : ''
                  }
                >
                  <td className="td-title">{book.title}</td>
                  <td className="td-author">{book.author}</td>
                  <td className="td-shelf">
                    <ShelfBadge shelf={book.shelf} />
                  </td>
                  <td className="td-rating">
                    <StarRating
                      value={book.rating}
                      onChange={r => onRatingChange(book, r)}
                      size="sm"
                    />
                  </td>
                  <td>
                    <span className={`badge ${SOURCE_CLASSES[book.source] ?? ''}`}>
                      {SOURCE_LABELS[book.source] ?? book.source}
                    </span>
                  </td>
                  <td className="td-date">
                    {new Date(book.date_updated).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="pagination">
          <button className="btn btn-ghost btn-sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
            ← Prev
          </button>
          <span className="page-info">
            Page {page + 1} of {totalPages}
          </span>
          <button className="btn btn-ghost btn-sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
            Next →
          </button>
        </div>
      )}
    </div>
  )
}
