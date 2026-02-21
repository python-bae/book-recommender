import { useState } from 'react'
import { StarRating } from './StarRating'
import type { Recommendation } from '../types'

interface Props {
  rec: Recommendation
  onSave: (rating: number) => void
  onClose: () => void
}

export function RatingNudge({ rec, onSave, onClose }: Props) {
  const [rating, setRating] = useState(0)

  function handleSave() {
    if (rating === 0) {
      alert('Please select a rating before saving.')
      return
    }
    onSave(rating)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        <h3 className="modal-title">How did you like it?</h3>
        <p className="modal-book-title">
          <strong>{rec.title}</strong> by {rec.author}
        </p>
        <p className="modal-subtitle">
          Your rating will be saved and used to improve future recommendations.
        </p>
        <div className="modal-stars">
          <StarRating value={rating} onChange={setRating} size="lg" />
        </div>
        <div className="modal-actions">
          <button className="btn btn-primary" onClick={handleSave} disabled={rating === 0}>
            Save Rating
          </button>
          <button className="btn btn-ghost" onClick={onClose}>
            Skip
          </button>
        </div>
      </div>
    </div>
  )
}
