import React from 'react'
import './Skeleton.css'

interface SkeletonProps {
  width?: string | number
  height?: string | number
  variant?: 'text' | 'circle' | 'rect'
  className?: string
  lines?: number
}

const Skeleton: React.FC<SkeletonProps> = ({
  width,
  height,
  variant = 'text',
  className = '',
  lines = 1,
}) => {
  if (lines > 1 && variant === 'text') {
    return (
      <div className={`wo-skeleton-group ${className}`}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className="wo-skeleton wo-skeleton--text"
            style={{
              width: i === lines - 1 ? '70%' : '100%',
              height: height ?? 14,
            }}
          />
        ))}
      </div>
    )
  }

  return (
    <div
      className={`wo-skeleton wo-skeleton--${variant} ${className}`}
      style={{
        width: width ?? (variant === 'circle' ? 40 : '100%'),
        height: height ?? (variant === 'circle' ? 40 : variant === 'text' ? 14 : 80),
      }}
    />
  )
}

export default Skeleton
