import type { WatchEvent } from '../../types'
import { Modal } from '../Modal'
import { Badge } from '../Badge'
import { LiveIndicator } from '../LiveIndicator'
import './EventDetailModal.css'

interface EventDetailModalProps {
  event: WatchEvent | null
  isOpen: boolean
  onClose: () => void
}

const EventDetailModal: React.FC<EventDetailModalProps> = ({ event, isOpen, onClose }) => {
  if (!event) return null

  const sentimentLabel = event.sentiment === 'escalation' ? '▲ Escalation'
    : event.sentiment === 'de-escalation' ? '▼ De-escalation'
    : '● Neutral'

  const sentimentClass = event.sentiment === 'escalation' ? 'text-red'
    : event.sentiment === 'de-escalation' ? 'text-green'
    : 'text-yellow'

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <div className="wo-event-detail">
        {/* Header */}
        <div className="wo-event-detail__header">
          <div className="wo-event-detail__header-top">
            <span className="wo-event-detail__country">
              <span className="wo-event-detail__flag">{event.countryFlag}</span>
              {event.country}
            </span>
            <LiveIndicator size="sm" />
          </div>
          <h2 className="wo-event-detail__title">{event.title}</h2>
        </div>

        {/* Metadata Grid */}
        <div className="wo-event-detail__meta-grid">
          <div className="wo-event-detail__meta-cell">
            <span className="wo-event-detail__meta-label">Severity</span>
            <Badge severity={event.severity} size="md" dot>
              {event.severity.toUpperCase()}
            </Badge>
          </div>
          <div className="wo-event-detail__meta-cell">
            <span className="wo-event-detail__meta-label">Sentiment</span>
            <span className={`wo-event-detail__meta-value ${sentimentClass}`}>
              {sentimentLabel}
            </span>
          </div>
          <div className="wo-event-detail__meta-cell">
            <span className="wo-event-detail__meta-label">Confidence</span>
            <span className="wo-event-detail__meta-value mono" style={{
              color: event.confidence >= 80 ? 'var(--signal-green)' : event.confidence >= 50 ? 'var(--signal-yellow)' : 'var(--signal-red)'
            }}>
              {event.confidence}%
            </span>
          </div>
          <div className="wo-event-detail__meta-cell">
            <span className="wo-event-detail__meta-label">Published</span>
            <span className="wo-event-detail__meta-value">{event.publishedAt}</span>
          </div>
          <div className="wo-event-detail__meta-cell">
            <span className="wo-event-detail__meta-label">Region</span>
            <span className="wo-event-detail__meta-value">{event.region}</span>
          </div>
          <div className="wo-event-detail__meta-cell">
            <span className="wo-event-detail__meta-label">24H Activity</span>
            <span className="wo-event-detail__meta-value mono">+{event.activityCount24h}</span>
          </div>
        </div>

        {/* Summary */}
        <div className="wo-event-detail__section">
          <h3 className="wo-event-detail__section-title">Summary</h3>
          <p className="wo-event-detail__summary">{event.summary}</p>
        </div>

        {/* Sources */}
        <div className="wo-event-detail__section">
          <h3 className="wo-event-detail__section-title">
            Sources
            <span className="wo-event-detail__source-count">{event.sources.length}</span>
          </h3>
          <div className="wo-event-detail__sources">
            {event.sources.map((source, idx) => (
              <a
                key={idx}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="wo-event-detail__source"
              >
                <span className="wo-event-detail__source-name">{source.name}</span>
                {source.credibility && (
                  <span className="wo-event-detail__source-cred mono" style={{
                    color: source.credibility >= 80 ? 'var(--signal-green)' : source.credibility >= 50 ? 'var(--signal-yellow)' : 'var(--signal-red)'
                  }}>
                    {source.credibility}%
                  </span>
                )}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </a>
            ))}
          </div>
        </div>

        {/* Contradictions */}
        {event.contradictions && (
          <div className="wo-event-detail__section">
            <h3 className="wo-event-detail__section-title wo-event-detail__section-title--warn">
              ⚠ Contradictions
            </h3>
            <p className="wo-event-detail__contradictions">{event.contradictions}</p>
          </div>
        )}

        {/* Bottom CTA */}
        <div className="wo-event-detail__footer">
          <a
            href={event.sources[0]?.url || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="wo-event-detail__source-btn"
          >
            View Primary Source
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
        </div>
      </div>
    </Modal>
  )
}

export default EventDetailModal
