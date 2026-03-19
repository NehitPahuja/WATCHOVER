import React from 'react'
import type { WatchEvent } from '../../types'
import { Badge } from '../Badge'
import './EventCard.css'

interface EventCardProps {
  event: WatchEvent
  onViewDetail?: (event: WatchEvent) => void
}

const EventCard: React.FC<EventCardProps> = React.memo(({ event, onViewDetail }) => {

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
      className={`wo-event-card wo-event-card--${variant}`}
      onClick={() => onViewDetail?.(event)}
      onKeyDown={(e) => { if (e.key === 'Enter') onViewDetail?.(event) }}
      tabIndex={0}
      role="button"
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
    </article>
  )
})

EventCard.displayName = 'EventCard'

export default EventCard
