import { useState, useMemo, useCallback } from 'react'
import type { WatchEvent } from '../../types'
import { EventCard } from '../EventCard'
import { EventDetailModal } from '../EventDetailModal'
import { SmartDigest } from '../SmartDigest'
import { VirtualList } from '../VirtualList'
import { useDebounce } from '../../hooks/useDebounce'
import './PulseFeed.css'

type FilterTab = 'all' | 'high' | 'medium' | '24h' | 'escalation' | 'de-escalation'

interface PulseFeedProps {
  events: WatchEvent[]
}

const FILTER_TABS: { key: FilterTab; label: string; variant?: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'high', label: 'High' },
  { key: 'medium', label: 'Medium' },
  { key: '24h', label: '24H' },
  { key: 'escalation', label: 'Escalation', variant: 'esc' },
  { key: 'de-escalation', label: 'De-escalation', variant: 'de-esc' },
]

/** Height of each EventCard in pixels (used for virtual list windowing) */
const EVENT_CARD_HEIGHT = 110

/** Threshold for using virtualized vs flat list */
const VIRTUALIZATION_THRESHOLD = 20

const PulseFeed: React.FC<PulseFeedProps> = ({ events }) => {
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedEvent, setSelectedEvent] = useState<WatchEvent | null>(null)

  // Debounce search input to avoid re-filtering on every keystroke
  const debouncedSearch = useDebounce(searchQuery, 300)

  const filteredEvents = useMemo(() => {
    let filtered = events

    // Apply tab filter
    switch (activeFilter) {
      case 'high':
        filtered = filtered.filter(e => e.severity === 'high' || e.severity === 'critical')
        break
      case 'medium':
        filtered = filtered.filter(e => e.severity === 'medium')
        break
      case '24h':
        // All mock events are within 24h, in production compare timestamps
        break
      case 'escalation':
        filtered = filtered.filter(e => e.sentiment === 'escalation')
        break
      case 'de-escalation':
        filtered = filtered.filter(e => e.sentiment === 'de-escalation')
        break
    }

    // Apply debounced search (doesn't fire until typing pauses for 300ms)
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase()
      filtered = filtered.filter(e =>
        e.title.toLowerCase().includes(q) ||
        e.region.toLowerCase().includes(q) ||
        e.country.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q)
      )
    }

    return filtered
  }, [events, activeFilter, debouncedSearch])

  // Memoize the event card renderer for VirtualList
  const renderEvent = useCallback(
    (event: WatchEvent) => (
      <EventCard
        event={event}
        onViewDetail={(e) => setSelectedEvent(e)}
      />
    ),
    []
  )

  const getEventKey = useCallback((event: WatchEvent) => event.id, [])

  // Use virtualized list for large datasets, flat list for small ones
  const shouldVirtualize = filteredEvents.length > VIRTUALIZATION_THRESHOLD

  return (
    <div className="wo-pulse-feed">
      {/* Smart Digest — AI Intelligence Briefing */}
      <SmartDigest />

      {/* Header + Filters */}
      <div className="wo-pulse-feed__header">
        <h2 className="wo-pulse-feed__title">Pulse Feed</h2>
        <div className="wo-pulse-feed__filters">
          {FILTER_TABS.map(tab => (
            <button
              key={tab.key}
              className={`wo-pulse-feed__filter-tab ${activeFilter === tab.key ? 'wo-pulse-feed__filter-tab--active' : ''} ${tab.variant ? `wo-pulse-feed__filter-tab--${tab.variant}` : ''}`}
              onClick={() => setActiveFilter(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Search (onChange fires immediately for UI, but filtering is debounced) */}
      <div className="wo-pulse-feed__search">
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          placeholder="Search events, regions, keywords..."
          className="wo-pulse-feed__search-input"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button
            className="wo-pulse-feed__search-clear"
            onClick={() => setSearchQuery('')}
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
      </div>

      {/* Event Count */}
      <div className="wo-pulse-feed__count">
        <span className="mono">{filteredEvents.length}</span> events
        {debouncedSearch && <span> matching "{debouncedSearch}"</span>}
      </div>

      {/* Event List — Virtualized for large datasets */}
      {filteredEvents.length > 0 ? (
        shouldVirtualize ? (
          <VirtualList
            items={filteredEvents}
            itemHeight={EVENT_CARD_HEIGHT}
            overscan={5}
            renderItem={renderEvent}
            getKey={getEventKey}
            className="wo-pulse-feed__list wo-pulse-feed__list--virtual"
          />
        ) : (
          <div className="wo-pulse-feed__list">
            {filteredEvents.map(event => (
              <EventCard
                key={event.id}
                event={event}
                onViewDetail={(e) => setSelectedEvent(e)}
              />
            ))}
          </div>
        )
      ) : (
        <div className="wo-pulse-feed__list">
          <div className="wo-pulse-feed__empty">
            <span className="wo-pulse-feed__empty-icon">◇</span>
            <p>No events match your filters</p>
            <button
              className="wo-pulse-feed__empty-reset"
              onClick={() => { setActiveFilter('all'); setSearchQuery('') }}
            >
              Reset filters
            </button>
          </div>
        </div>
      )}

      {/* Event Detail Modal */}
      <EventDetailModal
        event={selectedEvent}
        isOpen={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
      />
    </div>
  )
}

export default PulseFeed
