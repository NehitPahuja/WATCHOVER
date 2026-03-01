import React from 'react'
import './Badge.css'

type BadgeSeverity = 'high' | 'medium' | 'low' | 'info' | 'escalation' | 'de-escalation'

interface BadgeProps {
  severity: BadgeSeverity
  children: React.ReactNode
  size?: 'sm' | 'md'
  dot?: boolean
}

const Badge: React.FC<BadgeProps> = ({
  severity,
  children,
  size = 'sm',
  dot = false,
}) => {
  return (
    <span className={`wo-badge wo-badge--${severity} wo-badge--${size}`}>
      {dot && <span className="wo-badge__dot" />}
      {children}
    </span>
  )
}

export default Badge
