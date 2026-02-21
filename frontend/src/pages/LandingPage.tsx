import type { Page } from '../types'

interface Props {
  bookCount: number
  ratedCount: number
  onNavigate: (page: Page) => void
}

export function LandingPage({ bookCount, ratedCount, onNavigate }: Props) {
  return (
    <div className="landing">
      <header className="landing-header">
        <div className="landing-logo">📚</div>
        <h1 className="landing-title">Book Recommender</h1>
        <p className="landing-subtitle">
          Personalized book picks based on your reading history
        </p>
        {bookCount > 0 && (
          <p className="landing-stats">
            {bookCount} book{bookCount !== 1 ? 's' : ''} in your library &middot; {ratedCount} rated
          </p>
        )}
      </header>

      <div className="landing-cards">
        <button
          className="landing-card landing-card-primary"
          onClick={() => onNavigate('recommender')}
        >
          <div className="landing-card-icon">🔍</div>
          <h2 className="landing-card-title">Get Recommendations</h2>
          <ul className="landing-card-features">
            <li>5 personalized picks per batch</li>
            <li>Optional genre mood filter</li>
            <li>Discover new authors</li>
            <li>Refresh for different books</li>
          </ul>
          <span className="landing-card-cta">
            {bookCount === 0 ? 'Start — upload CSV' : 'Find my next read →'}
          </span>
        </button>

        <button
          className="landing-card landing-card-secondary"
          onClick={() => onNavigate('library')}
        >
          <div className="landing-card-icon">⭐</div>
          <h2 className="landing-card-title">My Library & Ratings</h2>
          <ul className="landing-card-features">
            <li>Rate a book you read</li>
            <li>Add a new book manually</li>
            <li>Re-upload Goodreads CSV</li>
            <li>Browse your full book list</li>
          </ul>
          <span className="landing-card-cta">Manage my library →</span>
        </button>
      </div>

      {bookCount === 0 && (
        <p className="landing-hint">
          Start by uploading your Goodreads CSV export in either section above.
        </p>
      )}
    </div>
  )
}
