/**
 * LazySection — Wraps a child component and defers its rendering
 * until the section scrolls (or nearly scrolls) into the viewport.
 *
 * Shows a subtle skeleton placeholder until the content loads.
 */

import React, { type ReactNode } from 'react'
import { useLazyLoad } from '../../hooks/useLazyLoad'
import { Skeleton } from '../Skeleton'
import './LazySection.css'

interface LazySectionProps {
  children: ReactNode
  /** Height of the placeholder (default: 200px) */
  placeholderHeight?: number
  /** Root margin for IntersectionObserver (default: '300px') */
  rootMargin?: string
  /** Optional class name for the wrapper */
  className?: string
}

const LazySection: React.FC<LazySectionProps> = ({
  children,
  placeholderHeight = 200,
  rootMargin = '300px',
  className = '',
}) => {
  const [ref, isVisible] = useLazyLoad<HTMLDivElement>({ rootMargin })

  return (
    <div ref={ref} className={`wo-lazy-section ${className}`}>
      {isVisible ? (
        children
      ) : (
        <div
          className="wo-lazy-section__placeholder"
          style={{ minHeight: placeholderHeight }}
        >
          <Skeleton width="100%" height={placeholderHeight} />
        </div>
      )}
    </div>
  )
}

export default LazySection
