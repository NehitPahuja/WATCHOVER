import { useRef, useState, useEffect } from 'react'
import './NewsTicker.css'

export interface TickerItem {
  id: string
  text: string
  severity?: 'high' | 'medium' | 'low'
  onClick?: () => void
}

interface NewsTickerProps {
  items: TickerItem[]
  speed?: number // pixels per second
}

const NewsTicker: React.FC<NewsTickerProps> = ({
  items,
  speed = 40,
}) => {
  const trackRef = useRef<HTMLDivElement>(null)
  const [isPaused, setIsPaused] = useState(false)

  // Calculate animation duration based on content width
  const [duration, setDuration] = useState(30)

  useEffect(() => {
    if (trackRef.current) {
      const width = trackRef.current.scrollWidth / 2 // divide by 2 since we duplicate
      setDuration(width / speed)
    }
  }, [items, speed])

  if (items.length === 0) return null

  // Duplicate items for seamless infinite scroll
  const displayItems = [...items, ...items]

  return (
    <div
      className="wo-ticker"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      role="marquee"
      aria-label="Latest news"
    >
      <div className="wo-ticker__label">
        <span className="wo-ticker__label-dot" />
        LATEST
      </div>

      <div className="wo-ticker__track-wrapper">
        <div
          ref={trackRef}
          className={`wo-ticker__track ${isPaused ? 'wo-ticker__track--paused' : ''}`}
          style={{ animationDuration: `${duration}s` }}
        >
          {displayItems.map((item, idx) => (
            <button
              key={`${item.id}-${idx}`}
              className={`wo-ticker__item ${item.severity ? `wo-ticker__item--${item.severity}` : ''}`}
              onClick={item.onClick}
              tabIndex={idx >= items.length ? -1 : 0}
            >
              {item.severity && (
                <span className={`wo-ticker__severity wo-ticker__severity--${item.severity}`}>
                  ●
                </span>
              )}
              <span className="wo-ticker__text">{item.text}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default NewsTicker
