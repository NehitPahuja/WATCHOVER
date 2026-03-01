import React from 'react'
import './LiveIndicator.css'

interface LiveIndicatorProps {
  label?: string
  size?: 'sm' | 'md'
}

const LiveIndicator: React.FC<LiveIndicatorProps> = ({
  label = 'LIVE',
  size = 'md',
}) => {
  return (
    <span className={`wo-live wo-live--${size}`} aria-label="Live updates active">
      <span className="wo-live__dot">
        <span className="wo-live__dot-ring" />
      </span>
      <span className="wo-live__label">{label}</span>
    </span>
  )
}

export default LiveIndicator
