import { RecommendationCard } from './RecommendationCard'
import { RatingNudge } from './RatingNudge'
import { useState } from 'react'
import type { Recommendation } from '../types'

interface Props {
  recommendations: Recommendation[]
  savedRatings: Record<string, number>   // google_books_id → rating
  batchNumber: number
  onRefresh: () => void
  refreshing: boolean
  onRate: (rec: Recommendation, rating: number) => void
}

export function RecommendationList({
  recommendations,
  savedRatings,
  batchNumber,
  onRefresh,
  refreshing,
  onRate,
}: Props) {
  const [nudgeRec, setNudgeRec] = useState<Recommendation | null>(null)

  function handleRate(rating: number) {
    if (nudgeRec) {
      onRate(nudgeRec, rating)
      setNudgeRec(null)
    }
  }

  return (
    <section className="rec-list-section">
      <div className="rec-list-header">
        <h2 className="rec-list-title">Your Recommendations</h2>
        {batchNumber > 1 && (
          <span className="batch-label">Batch {batchNumber}</span>
        )}
      </div>

      <div className="rec-list">
        {recommendations.map((rec, i) => (
          <RecommendationCard
            key={rec.google_books_id}
            rec={rec}
            rank={i + 1}
            savedRating={savedRatings[rec.google_books_id]}
            onLiked={r => setNudgeRec(r)}
          />
        ))}
      </div>

      <div className="rec-list-footer">
        <button
          className="btn btn-outline"
          onClick={onRefresh}
          disabled={refreshing}
        >
          {refreshing ? 'Finding more books...' : 'Show me different books'}
        </button>
        <p className="rec-footer-note">
          Recommendations that don't repeat books you've already seen.
        </p>
      </div>

      {nudgeRec && (
        <RatingNudge
          rec={nudgeRec}
          onSave={handleRate}
          onClose={() => setNudgeRec(null)}
        />
      )}
    </section>
  )
}
