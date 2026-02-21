import { useState } from 'react'
import { StarRating } from './StarRating'
import type { Recommendation } from '../types'

interface Props {
  rec: Recommendation
  rank: number
  savedRating?: number
  onLiked: (rec: Recommendation) => void
}

export function RecommendationCard({ rec, rank, savedRating, onLiked }: Props) {
  const [expanded, setExpanded] = useState(false)
  const descLimit = 220
  const shortDesc = rec.description.slice(0, descLimit)

  return (
    <article className="rec-card">
      <div className="rec-rank">#{rank}</div>

      <div className="rec-cover-wrap">
        {rec.cover_url ? (
          <img
            src={rec.cover_url}
            alt={`Cover of ${rec.title}`}
            className="rec-cover"
            loading="lazy"
          />
        ) : (
          <div className="rec-cover-placeholder">
            <span>📚</span>
          </div>
        )}
      </div>

      <div className="rec-info">
        <div className="rec-badges">
          <span className="badge badge-genre">{rec.genre}</span>
          {rec.is_new_author && <span className="badge badge-new">New to you</span>}
          {savedRating !== undefined && (
            <span className="badge badge-rated">
              Rated <StarRating value={savedRating} onChange={() => {}} readOnly size="sm" />
            </span>
          )}
        </div>

        <h3 className="rec-title">{rec.title}</h3>
        <p className="rec-author">by {rec.author}</p>

        <div className="rec-predicted">
          Predicted match: <StarRating value={Math.round(rec.predicted_rating)} onChange={() => {}} readOnly size="sm" />
          <span className="rec-predicted-num">{rec.predicted_rating.toFixed(1)}/5</span>
        </div>

        {rec.description && (
          <p className="rec-desc">
            {expanded ? rec.description : shortDesc}
            {rec.description.length > descLimit && (
              <button className="link-btn" onClick={() => setExpanded(!expanded)}>
                {expanded ? ' show less' : '... more'}
              </button>
            )}
          </p>
        )}

        <div className="rec-reason">
          <span className="reason-label">Why for you:</span> {rec.reason}
        </div>

        {savedRating === undefined && (
          <button className="btn btn-outline btn-sm mt-sm" onClick={() => onLiked(rec)}>
            I read this — rate it
          </button>
        )}
      </div>
    </article>
  )
}
