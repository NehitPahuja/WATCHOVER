import React from 'react'
import './Card.css'

interface CardProps {
  children: React.ReactNode
  variant?: 'default' | 'escalation' | 'de-escalation'
  hoverable?: boolean
  onClick?: () => void
  className?: string
}

const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  hoverable = false,
  onClick,
  className = '',
}) => {
  return (
    <div
      className={`wo-card wo-card--${variant} ${hoverable ? 'wo-card--hoverable' : ''} ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick() } : undefined}
    >
      {children}
    </div>
  )
}

export default Card
