/**
 * Security Middleware
 *
 * Composable middleware functions for API route protection.
 * Combines rate limiting, auth verification, RBAC, input sanitization,
 * and security headers into reusable handler wrappers.
 *
 * Usage:
 *   import { withSecurity } from '../../server/lib/middleware'
 *
 *   export default withSecurity(handler, {
 *     rateLimit: 'api',        // 'api' | 'write' | 'ws' | false
 *     auth: 'required',       // 'required' | 'optional' | 'none'
 *     permission: 'events:read',
 *     sanitizeBody: true,
 *     audit: { action: 'event:create', entityType: 'event' },
 *   })
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyAuth, hasPermission, type Permission, type AuthSession } from './auth'
import {
  createApiRateLimiter,
  createWriteRateLimiter,
  createWsRateLimiter,
  checkRateLimit,
} from './ratelimit'
import { sanitizeObject, sanitizeString } from './sanitize'
import { logAuditEvent, getClientIp, type AuditAction, type AuditEntityType } from './audit'
import { createDb } from '../db'

// =============================================
// Middleware Configuration
// =============================================

export interface SecurityOptions {
  /** Rate limit tier to apply. Set false to disable. Default: 'api' */
  rateLimit?: 'api' | 'write' | 'ws' | false
  /** Auth requirement. Default: 'none' */
  auth?: 'required' | 'optional' | 'none'
  /** Required permission (checked if auth is present). */
  permission?: Permission
  /** Whether to sanitize the request body. Default: false */
  sanitizeBody?: boolean
  /** Audit log configuration for this endpoint. */
  audit?: {
    action: AuditAction
    entityType: AuditEntityType
  }
}

export type SecuredHandler = (
  req: VercelRequest,
  res: VercelResponse,
  session: AuthSession | null
) => Promise<VercelResponse | void>

// Rate limiter singletons
let apiLimiter: ReturnType<typeof createApiRateLimiter> | null = null
let writeLimiter: ReturnType<typeof createWriteRateLimiter> | null = null
let wsLimiter: ReturnType<typeof createWsRateLimiter> | null = null

function getRateLimiter(tier: 'api' | 'write' | 'ws') {
  switch (tier) {
    case 'api':
      if (!apiLimiter) apiLimiter = createApiRateLimiter()
      return apiLimiter
    case 'write':
      if (!writeLimiter) writeLimiter = createWriteRateLimiter()
      return writeLimiter
    case 'ws':
      if (!wsLimiter) wsLimiter = createWsRateLimiter()
      return wsLimiter
  }
}

// =============================================
// Security Headers
// =============================================

/**
 * Apply security headers to the response.
 */
function applySecurityHeaders(res: VercelResponse): void {
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff')

  // XSS protection (legacy browsers)
  res.setHeader('X-XSS-Protection', '1; mode=block')

  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY')

  // Strict transport security (HTTPS everywhere)
  res.setHeader(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains; preload'
  )

  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')

  // Content Security Policy
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.clerk.dev https://clerk.watchover.app",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https: blob:",
      "connect-src 'self' https: wss:",
      "frame-src 'self' https://clerk.watchover.app",
    ].join('; ')
  )

  // Permissions Policy
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(self), interest-cohort=()'
  )
}

// =============================================
// Main Middleware Wrapper
// =============================================

/**
 * Wrap an API handler with security middleware.
 *
 * Applies (in order):
 * 1. Security headers
 * 2. Rate limiting
 * 3. Auth verification
 * 4. RBAC permission check
 * 5. Input sanitization
 * 6. Audit logging (on success)
 */
export function withSecurity(
  handler: SecuredHandler,
  options: SecurityOptions = {}
) {
  const {
    rateLimit: rateLimitTier = 'api',
    auth: authMode = 'none',
    permission,
    sanitizeBody = false,
    audit,
  } = options

  return async (req: VercelRequest, res: VercelResponse) => {
    // 1. Security headers
    applySecurityHeaders(res)

    // 2. Rate limiting
    if (rateLimitTier !== false) {
      try {
        const limiter = getRateLimiter(rateLimitTier)
        // Use IP address or auth token as identifier
        const ip = getClientIp(req.headers as Record<string, string | string[] | undefined>)
        const identifier = ip || 'anonymous'

        const { success, remaining, reset } = await checkRateLimit(limiter, identifier)

        // Set rate limit headers
        res.setHeader('X-RateLimit-Remaining', remaining.toString())
        res.setHeader('X-RateLimit-Reset', reset.toString())

        if (!success) {
          return res.status(429).json({
            error: 'Too Many Requests',
            message: 'Rate limit exceeded. Please try again later.',
            retryAfter: Math.ceil((reset - Date.now()) / 1000),
          })
        }
      } catch (error) {
        // Don't block requests if rate limiter is down
        console.warn('[SECURITY] Rate limiter unavailable:', error instanceof Error ? error.message : error)
      }
    }

    // 3. Auth verification
    let session: AuthSession | null = null
    if (authMode !== 'none') {
      session = await verifyAuth(req as unknown as Request)

      if (authMode === 'required' && !session) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required. Please sign in.',
        })
      }
    }

    // 4. RBAC permission check
    if (permission && session) {
      if (!hasPermission(session.role, permission)) {
        // Log failed permission attempt
        if (audit) {
          try {
            const db = createDb()
            await logAuditEvent(db, {
              userId: session.userId,
              action: audit.action,
              entityType: audit.entityType,
              metadata: {
                denied: true,
                requiredPermission: permission,
                userRole: session.role,
              },
              ipAddress: getClientIp(req.headers as Record<string, string | string[] | undefined>),
            })
          } catch { /* audit logging is best-effort */ }
        }

        return res.status(403).json({
          error: 'Forbidden',
          message: 'You do not have permission to perform this action.',
          requiredPermission: permission,
        })
      }
    }

    // 5. Input sanitization
    if (sanitizeBody && req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body)
    }

    // 6. Execute handler
    const result = await handler(req, res, session)

    // 7. Audit logging (on success — only if status < 400)
    if (audit && session && res.statusCode < 400) {
      try {
        const db = createDb()
        await logAuditEvent(db, {
          userId: session.userId,
          action: audit.action,
          entityType: audit.entityType,
          metadata: {
            method: req.method,
            path: req.url,
          },
          ipAddress: getClientIp(req.headers as Record<string, string | string[] | undefined>),
        })
      } catch { /* audit logging is best-effort */ }
    }

    return result
  }
}

// =============================================
// Convenience Wrappers
// =============================================

/**
 * Public read-only endpoint with rate limiting.
 * No auth required.
 */
export function withPublicRead(handler: SecuredHandler) {
  return withSecurity(handler, {
    rateLimit: 'api',
    auth: 'none',
  })
}

/**
 * Authenticated read endpoint with rate limiting.
 * Auth required, no specific permission.
 */
export function withAuthRead(handler: SecuredHandler, permission?: Permission) {
  return withSecurity(handler, {
    rateLimit: 'api',
    auth: 'required',
    permission,
  })
}

/**
 * Authenticated write endpoint with stricter rate limiting.
 * Auth required, specific permission, body sanitization, audit logging.
 */
export function withAuthWrite(
  handler: SecuredHandler,
  permission: Permission,
  audit: { action: AuditAction; entityType: AuditEntityType }
) {
  return withSecurity(handler, {
    rateLimit: 'write',
    auth: 'required',
    permission,
    sanitizeBody: true,
    audit,
  })
}

/**
 * Admin-only endpoint with full security.
 */
export function withAdmin(
  handler: SecuredHandler,
  audit: { action: AuditAction; entityType: AuditEntityType }
) {
  return withSecurity(handler, {
    rateLimit: 'write',
    auth: 'required',
    permission: 'users:manage',
    sanitizeBody: true,
    audit,
  })
}
