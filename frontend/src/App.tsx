import { useState, useCallback } from 'react'
import { LandingPage } from './pages/LandingPage'
import { RecommenderPage } from './pages/RecommenderPage'
import { LibraryPage } from './pages/LibraryPage'
import { getAllBooks, getRatedBooks } from './utils/storage'
import type { Page, BookEntry } from './types'

export default function App() {
  const [page, setPage] = useState<Page>('landing')
  const [books, setBooks] = useState<BookEntry[]>(() => getAllBooks())

  // Refresh the book list from localStorage whenever the library changes
  const handleLibraryUpdate = useCallback(() => {
    setBooks(getAllBooks())
  }, [])

  return (
    <div className="app">
      {page === 'landing' && (
        <LandingPage
          bookCount={books.length}
          ratedCount={getRatedBooks().length}
          onNavigate={setPage}
        />
      )}
      {page === 'recommender' && (
        <RecommenderPage
          onNavigate={setPage}
          onLibraryUpdate={handleLibraryUpdate}
        />
      )}
      {page === 'library' && (
        <LibraryPage
          books={books}
          onNavigate={setPage}
          onLibraryUpdate={handleLibraryUpdate}
        />
      )}
    </div>
  )
}
