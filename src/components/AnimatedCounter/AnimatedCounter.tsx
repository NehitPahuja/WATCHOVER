import React, { useEffect, useRef, useState } from 'react'
import './AnimatedCounter.css'

// =============================================
// Props
// =============================================

interface AnimatedCounterProps {
  value: number
  /** Duration of the animation in ms */
  duration?: number
  /** CSS class for the value text */
  className?: string
  /** Format the number (e.g., toLocaleString) */
  format?: (value: number) => string
  /** Show flash effect on change */
  flashOnChange?: boolean
}

// =============================================
// Component
// =============================================

const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  value,
  duration = 600,
  className = '',
  format = (v) => v.toLocaleString(),
  flashOnChange = true,
}) => {
  const [displayValue, setDisplayValue] = useState(value)
  const [isFlashing, setIsFlashing] = useState(false)
  const prevValueRef = useRef(value)
  const animationRef = useRef<number | null>(null)

  useEffect(() => {
    const prevValue = prevValueRef.current
    prevValueRef.current = value

    // Skip animation on first render or same value
    if (prevValue === value) return

    // Trigger flash
    if (flashOnChange) {
      setIsFlashing(true)
      setTimeout(() => setIsFlashing(false), 400)
    }

    // Animate from prev to new value
    const startTime = Date.now()
    const diff = value - prevValue

    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)

      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)

      const current = Math.round(prevValue + diff * eased)
      setDisplayValue(current)

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate)
      } else {
        setDisplayValue(value)
      }
    }

    animationRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [value, duration, flashOnChange])

  return (
    <span className={`wo-animated-counter ${className} ${isFlashing ? 'wo-animated-counter--flash' : ''}`}>
      {format(displayValue)}
    </span>
  )
}

export default AnimatedCounter
