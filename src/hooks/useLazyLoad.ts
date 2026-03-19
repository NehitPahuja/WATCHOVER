/**
 * useLazyLoad — Defers rendering of a component until it enters the viewport.
 * Uses IntersectionObserver for efficient visibility detection.
 */

import { useState, useEffect, useRef, type RefObject } from 'react'

interface UseLazyLoadOptions {
  /** Distance from the viewport edge to start loading (default: '200px') */
  rootMargin?: string
  /** Visibility threshold to trigger (0-1, default: 0) */
  threshold?: number
  /** If true, once loaded it stays loaded even when scrolled out of view (default: true) */
  once?: boolean
}

/**
 * Returns a ref to attach to a sentinel element and a boolean indicating
 * whether the component should be rendered.
 */
export function useLazyLoad<T extends HTMLElement = HTMLDivElement>(
  options: UseLazyLoadOptions = {}
): [RefObject<T | null>, boolean] {
  const { rootMargin = '200px', threshold = 0, once = true } = options
  const ref = useRef<T | null>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    // If already visible and `once` mode, skip observer
    if (once && isVisible) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          if (once) {
            observer.unobserve(element)
          }
        } else if (!once) {
          setIsVisible(false)
        }
      },
      { rootMargin, threshold }
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [rootMargin, threshold, once, isVisible])

  return [ref, isVisible]
}
