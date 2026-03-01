import { useState } from 'react'
import type { WatchEvent } from '../../types'
import { Badge } from '../Badge'
import './EventCard.css'

interface EventCardProps {
  event: WatchEvent
  onViewDetail?: (event: WatchEvent) => void
}

const EventCard: React.FC<EventCardProps> = ({ event, onViewDetail }) => {
  const [expanded, setExpanded] = useState(false)

  const variant = event.sentiment === 'escalation'
    ? 'escalation'
    : event.sentiment === 'de-escalation'
      ? 'de-escalation'
      : 'default'

  const confidenceColor = event.confidence >= 80
    ? 'var(--signal-green)'
    : event.confidence >= 50
      ? 'var(--signal-yellow)'
      : 'var(--signal-red)'

  return (
    <article
      className={`wo-event-card wo-event-card--${variant} ${expanded ? 'wo-event-card--expanded' : ''}`}
      onClick={() => setExpanded(!expanded)}
      onKeyDown={(e) => { if (e.key === 'Enter') setExpanded(!expanded) }}
      tabIndex={0}
      role="button"
      aria-expanded={expanded}
    >
      {/* Top row — Badge + Time */}
      <div className="wo-event-card__top">
        <Badge severity={event.severity} dot>
          {event.severity.toUpperCase()}
        </Badge>
        <span className="wo-event-card__time mono">{event.timeAgo}</span>
      </div>

      {/* Title */}
      <h3 className="wo-event-card__title">
        <span className="wo-event-card__flag">{event.countryFlag}</span>
        {event.title}
      </h3>

      {/* Meta row */}
      <div className="wo-event-card__meta">
        <span className="wo-event-card__region">{event.region}</span>
        <div className="wo-event-card__confidence">
          <span className="text-muted">Confidence</span>
          <span className="mono" style={{ color: confidenceColor }}>{event.confidence}%</span>
        </div>
      </div>

      {/* Expanded section — Summary + View Detail */}
      {expanded && (
        <div className="wo-event-card__expanded">
          <p className="wo-event-card__summary">{event.summary}</p>

          <div className="wo-event-card__expanded-meta">
            <div className="wo-event-card__meta-item">
              <span className="wo-event-card__meta-label">Sentiment</span>
              <span className={`wo-event-card__meta-value ${
                event.sentiment === 'escalation' ? 'text-red' :
                event.sentiment === 'de-escalation' ? 'text-green' : 'text-yellow'
              }`}>
                {event.sentiment === 'escalation' ? '▲ Escalation' :
                 event.sentiment === 'de-escalation' ? '▼ De-escalation' : '● Neutral'}
              </span>
            </div>
            <div className="wo-event-card__meta-item">
              <span className="wo-event-card__meta-label">Category</span>
              <span className="wo-event-card__meta-value">{event.category}</span>
            </div>
            <div className="wo-event-card__meta-item">
              <span className="wo-event-card__meta-label">Sources</span>
              <span className="wo-event-card__meta-value">{event.sources.length}</span>
            </div>
            <div className="wo-event-card__meta-item">
              <span className="wo-event-card__meta-label">24H Activity</span>
              <span className="wo-event-card__meta-value mono">+{event.activityCount24h}</span>
            </div>
          </div>

          <button
            className="wo-event-card__detail-btn"
            onClick={(e) => {
              e.stopPropagation()
              onViewDetail?.(event)
            }}
          >
            View Full Detail →
          </button>
        </div>
      )}

      {/* Expand arrow */}
      <div className={`wo-event-card__arrow ${expanded ? 'wo-event-card__arrow--up' : ''}`}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
    </article>
  )
}

export default EventCard
