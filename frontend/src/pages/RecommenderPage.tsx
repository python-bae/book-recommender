import { useState, useCallback } from 'react'
import { UploadStep } from '../components/UploadStep'
import { RecommendationList } from '../components/RecommendationList'
import { parseGoodreadsCSV } from '../utils/csvParser'
import {
  getRatedBooks,
  getBookCount,
  getShownBookIds,
  addShownBookIds,
  mergeBooks,
  upsertBook,
} from '../utils/storage'
import { getRecommendations } from '../api/client'
import type { Page, Recommendation } from '../types'

interface Props {
  onNavigate: (page: Page) => void
  onLibraryUpdate: () => void
}

type Stage = 'setup' | 'loading' | 'results' | 'error'

export function RecommenderPage({ onNavigate, onLibraryUpdate }: Props) {
  const bookCount = getBookCount()
  const [genreMood, setGenreMood] = useState('')
  const [stage, setStage] = useState<Stage>('setup')
  const [error, setError] = useState('')
  const [recs, setRecs] = useState<Recommendation[]>([])
  const [preferenceSummary, setPreferenceSummary] = useState('')
  const [batchNumber, setBatchNumber] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [savedRatings, setSavedRatings] = useState<Record<string, number>>({})
  const [csvLoading, setCsvLoading] = useState(false)

  async function handleCsvUpload(file: File) {
    setCsvLoading(true)
    try {
      const books = await parseGoodreadsCSV(file)
      mergeBooks(books)
      onLibraryUpdate()
    } catch (e: unknown) {
      console.error('[CSV] Parse error:', e)
      setError(e instanceof Error ? e.message : 'Failed to parse CSV')
      setStage('error')
    } finally {
      setCsvLoading(false)
    }
  }

  const fetchRecs = useCallback(async (isRefresh = false) => {
    const rated = getRatedBooks()
    if (rated.length < 3) {
      setError('You need at least 3 rated books. Add more in My Library & Ratings.')
      setStage('error')
      return
    }

    if (isRefresh) {
      setRefreshing(true)
    } else {
      setStage('loading')
    }
    setError('')

    try {
      const shown = getShownBookIds()
      const data = await getRecommendations(rated, genreMood, shown)
      const ids = data.recommendations.map(r => r.google_books_id)
      addShownBookIds(ids)
      setRecs(data.recommendations)
      setPreferenceSummary(data.preference_summary)
      setBatchNumber(b => b + 1)
      setStage('results')
    } catch (e: unknown) {
      console.error('[Recommender] Failed to get recommendations:', e)
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.')
      setStage('error')
    } finally {
      setRefreshing(false)
    }
  }, [genreMood])

  function handleRate(rec: Recommendation, rating: number) {
    upsertBook({
      title: rec.title,
      author: rec.author,
      rating,
      shelf: 'read',
      source: 'recommended',
    })
    setSavedRatings(prev => ({ ...prev, [rec.google_books_id]: rating }))
    onLibraryUpdate()
  }

  const hasBooks = getBookCount() > 0

  return (
    <div className="page">
      <div className="page-nav">
        <button className="btn btn-ghost" onClick={() => onNavigate('landing')}>
          ← Home
        </button>
      </div>

      <h1 className="page-title">Get Recommendations</h1>

      {!hasBooks && (
        <div className="section">
          <p className="section-desc">Upload your Goodreads CSV to get started.</p>
          <UploadStep onFile={handleCsvUpload} loading={csvLoading} />
        </div>
      )}

      {hasBooks && stage !== 'results' && (
        <div className="section">
          <label className="form-label">
            What are you in the mood for? <span className="optional">(optional)</span>
            <input
              className="form-input"
              type="text"
              value={genreMood}
              onChange={e => setGenreMood(e.target.value)}
              placeholder="e.g. cozy mystery, hard sci-fi, historical fiction..."
              disabled={stage === 'loading'}
            />
          </label>

          <button
            className="btn btn-primary btn-lg"
            onClick={() => fetchRecs(false)}
            disabled={stage === 'loading'}
          >
            {stage === 'loading' ? (
              <>
                <span className="spinner" /> Finding your next reads...
              </>
            ) : (
              'Get Recommendations'
            )}
          </button>

          {stage === 'loading' && (
            <p className="loading-hint">
              Analyzing your reading history and searching for the perfect books...
            </p>
          )}
        </div>
      )}

      {stage === 'error' && (
        <div className="error-banner">
          <p>{error}</p>
          <div className="error-actions">
            <button className="btn btn-outline" onClick={() => setStage('setup')}>
              Try again
            </button>
            <button className="btn btn-ghost" onClick={() => onNavigate('library')}>
              Go to My Library
            </button>
          </div>
        </div>
      )}

      {stage === 'results' && (
        <>
          {preferenceSummary && (
            <div className="taste-summary">
              <h2 className="taste-summary-title">Your Reading Profile</h2>
              <p>{preferenceSummary}</p>
            </div>
          )}

          <div className="genre-controls">
            <label className="form-label">
              Change genre mood:
            </label>
            <div className="genre-controls-row">
              <input
                className="form-input"
                type="text"
                value={genreMood}
                onChange={e => setGenreMood(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !refreshing && fetchRecs(true)}
                placeholder="e.g. thriller, romance, fantasy..."
                disabled={refreshing}
              />
              <button
                className="btn btn-primary"
                onClick={() => fetchRecs(true)}
                disabled={refreshing}
              >
                {refreshing ? (
                  <><span className="spinner spinner-dark" /> Finding...</>
                ) : (
                  'Update'
                )}
              </button>
            </div>
          </div>

          <RecommendationList
            recommendations={recs}
            savedRatings={savedRatings}
            batchNumber={batchNumber}
            onRefresh={() => fetchRecs(true)}
            refreshing={refreshing}
            onRate={handleRate}
          />
        </>
      )}
    </div>
  )
}
