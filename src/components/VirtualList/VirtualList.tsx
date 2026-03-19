/**
 * VirtualList — A lightweight windowed list that only renders items
 * visible in the scroll viewport (plus a small overscan buffer).
 *
 * This dramatically reduces DOM node count for large event feeds,
 * keeping the UI responsive even with hundreds of events.
 */

import React, { useState, useRef, useCallback, useEffect, type ReactNode } from 'react'

interface VirtualListProps<T> {
  /** The full array of items */
  items: T[]
  /** Estimated height of each item in pixels */
  itemHeight: number
  /** Number of extra items to render above/below the visible window */
  overscan?: number
  /** Render function for each item */
  renderItem: (item: T, index: number) => ReactNode
  /** Unique key extractor */
  getKey: (item: T) => string | number
  /** Optional class for the scroll container */
  className?: string
  /** Optional class for the inner spacer */
  innerClassName?: string
}

function VirtualList<T>({
  items,
  itemHeight,
  overscan = 5,
  renderItem,
  getKey,
  className = '',
  innerClassName = '',
}: VirtualListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [containerHeight, setContainerHeight] = useState(0)

  // Track container resize
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateHeight = () => setContainerHeight(container.clientHeight)
    updateHeight()

    const observer = new ResizeObserver(updateHeight)
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  const handleScroll = useCallback(() => {
    if (containerRef.current) {
      setScrollTop(containerRef.current.scrollTop)
    }
  }, [])

  const totalHeight = items.length * itemHeight

  // Calculate visible range
  const startIdx = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
  const endIdx = Math.min(
    items.length,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  )

  const visibleItems = items.slice(startIdx, endIdx)
  const offsetY = startIdx * itemHeight

  return (
    <div
      ref={containerRef}
      className={className}
      onScroll={handleScroll}
      style={{ overflow: 'auto', position: 'relative' }}
    >
      <div
        className={innerClassName}
        style={{
          height: totalHeight,
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: offsetY,
            left: 0,
            right: 0,
          }}
        >
          {visibleItems.map((item, i) => (
            <div key={getKey(item)} style={{ height: itemHeight }}>
              {renderItem(item, startIdx + i)}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default React.memo(VirtualList) as typeof VirtualList
