/**
 * Input Sanitization Utilities
 *
 * Provides server-side sanitization for all user inputs using
 * a lightweight HTML sanitizer (no DOM dependency for Node.js).
 *
 * Defends against:
 * - XSS (cross-site scripting) via HTML injection
 * - SQL-injection-style payloads in text fields
 * - Oversized inputs
 * - Malicious URLs
 */

// =============================================
// HTML Entity Encoding
// =============================================

const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#96;',
}

const HTML_ENTITY_REGEX = /[&<>"'`/]/g

/**
 * Escape HTML entities in a string to prevent XSS.
 */
export function escapeHtml(str: string): string {
  return str.replace(HTML_ENTITY_REGEX, (char) => HTML_ENTITIES[char] || char)
}

// =============================================
// Strip HTML Tags
// =============================================

const HTML_TAG_REGEX = /<\/?[^>]+(>|$)/g
const SCRIPT_REGEX = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi
const EVENT_HANDLER_REGEX = /\s*on\w+\s*=\s*["'][^"']*["']/gi
const DATA_URI_REGEX = /data:\s*[^;]+;\s*base64/gi

/**
 * Remove all HTML tags and potentially dangerous content from a string.
 */
export function stripHtml(str: string): string {
  return str
    .replace(SCRIPT_REGEX, '')      // Remove <script> blocks first
    .replace(EVENT_HANDLER_REGEX, '') // Remove event handlers
    .replace(DATA_URI_REGEX, '')     // Remove data URIs
    .replace(HTML_TAG_REGEX, '')     // Remove all remaining HTML tags
    .trim()
}

// =============================================
// Input Sanitization
// =============================================

export interface SanitizeOptions {
  /** Maximum allowed string length (default: 1000) */
  maxLength?: number
  /** Whether to allow basic formatting (bold, italic) — strips everything else */
  allowBasicFormatting?: boolean
  /** Whether to trim whitespace */
  trim?: boolean
  /** Whether to collapse multiple spaces/newlines */
  collapseWhitespace?: boolean
}

const DEFAULT_OPTIONS: SanitizeOptions = {
  maxLength: 1000,
  allowBasicFormatting: false,
  trim: true,
  collapseWhitespace: true,
}

/**
 * Sanitize a user-provided string input.
 * Removes HTML, escapes special chars, enforces length limits.
 */
export function sanitizeString(
  input: unknown,
  options?: SanitizeOptions
): string {
  if (input === null || input === undefined) return ''
  if (typeof input !== 'string') return String(input)

  const opts = { ...DEFAULT_OPTIONS, ...options }
  let result = input

  // Strip HTML tags and dangerous content
  result = stripHtml(result)

  // Escape remaining HTML entities
  result = escapeHtml(result)

  // Trim
  if (opts.trim) {
    result = result.trim()
  }

  // Collapse whitespace
  if (opts.collapseWhitespace) {
    result = result.replace(/\s+/g, ' ')
  }

  // Enforce max length
  if (opts.maxLength && result.length > opts.maxLength) {
    result = result.slice(0, opts.maxLength)
  }

  return result
}

/**
 * Sanitize an object's string fields recursively.
 * Useful for sanitizing entire request bodies.
 */
export function sanitizeObject<T extends Record<string, unknown>>(
  obj: T,
  options?: SanitizeOptions
): T {
  const result = {} as Record<string, unknown>

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = sanitizeString(value, options)
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        typeof item === 'string'
          ? sanitizeString(item, options)
          : typeof item === 'object' && item !== null
            ? sanitizeObject(item as Record<string, unknown>, options)
            : item
      )
    } else if (typeof value === 'object' && value !== null) {
      result[key] = sanitizeObject(value as Record<string, unknown>, options)
    } else {
      result[key] = value
    }
  }

  return result as T
}

// =============================================
// URL Sanitization
// =============================================

const ALLOWED_PROTOCOLS = ['http:', 'https:']

/**
 * Sanitize and validate a URL.
 * Returns null for invalid or dangerous URLs (javascript:, data:, etc.).
 */
export function sanitizeUrl(url: unknown): string | null {
  if (typeof url !== 'string') return null

  const trimmed = url.trim()
  if (!trimmed) return null

  try {
    const parsed = new URL(trimmed)
    if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
      return null
    }
    return parsed.href
  } catch {
    return null
  }
}

// =============================================
// UUID Validation
// =============================================

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Validate that a string is a valid UUID v4.
 */
export function isValidUuid(id: unknown): id is string {
  return typeof id === 'string' && UUID_REGEX.test(id)
}

// =============================================
// Query Parameter Sanitization
// =============================================

const ALLOWED_SEVERITY = ['critical', 'high', 'medium', 'low'] as const
const ALLOWED_SENTIMENT = ['escalation', 'de-escalation', 'neutral'] as const
const ALLOWED_PREDICTION_STATUS = ['active', 'closed', 'resolved'] as const

/**
 * Validate and sanitize enum query parameters.
 */
export function sanitizeEnum<T extends string>(
  value: unknown,
  allowed: readonly T[]
): T | undefined {
  if (typeof value !== 'string') return undefined
  const lower = value.toLowerCase() as T
  return allowed.includes(lower) ? lower : undefined
}

export function sanitizeSeverity(value: unknown) {
  return sanitizeEnum(value, ALLOWED_SEVERITY)
}

export function sanitizeSentiment(value: unknown) {
  return sanitizeEnum(value, ALLOWED_SENTIMENT)
}

export function sanitizePredictionStatus(value: unknown) {
  return sanitizeEnum(value, ALLOWED_PREDICTION_STATUS)
}

/**
 * Sanitize a numeric query parameter.
 * Returns the number if valid, or the default value.
 */
export function sanitizeNumber(
  value: unknown,
  options: { min?: number; max?: number; default: number }
): number {
  const num = parseInt(String(value), 10)
  if (isNaN(num)) return options.default
  if (options.min !== undefined && num < options.min) return options.min
  if (options.max !== undefined && num > options.max) return options.max
  return num
}
