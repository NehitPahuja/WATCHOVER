/**
 * useDebounce — Delays updating a value until a specified delay has passed
 * since the last change. Useful for search inputs to avoid excessive filtering
 * or API calls on every keystroke.
 */

import { useState, useEffect } from 'react'

/**
 * Returns a debounced version of the input value.
 * The returned value only updates after `delay` ms of inactivity.
 *
 * @param value - The raw value to debounce
 * @param delay - Milliseconds to wait before updating (default: 300ms)
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(timer)
    }
  }, [value, delay])

  return debouncedValue
}
