/**
 * GET /api/audit-logs
 *
 * Returns paginated, filterable audit log entries.
 * Admin-only endpoint — requires 'audit:read' permission.
 *
 * Query params:
 *   - userId: Filter by user ID
 *   - action: Filter by action type
 *   - entityType: Filter by entity type
 *   - entityId: Filter by entity ID
 *   - since: ISO date string (inclusive)
 *   - until: ISO date string (inclusive)
 *   - limit: Max results (default: 50, max: 100)
 *   - offset: Pagination offset (default: 0)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { withSecurity, type SecuredHandler } from '../server/lib/middleware'
import { queryAuditLogs, type AuditQueryParams } from '../server/lib/audit'
import { isValidUuid, sanitizeNumber, sanitizeString } from '../server/lib/sanitize'
import { createDb } from '../server/db'

const handler: SecuredHandler = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const {
      userId,
      action,
      entityType,
      entityId,
      since,
      until,
      limit = '50',
      offset = '0',
    } = req.query

    // Validate userId if provided
    if (userId && !isValidUuid(userId)) {
      return res.status(400).json({ error: 'Invalid userId format' })
    }

    // Validate entityId if provided
    if (entityId && !isValidUuid(entityId)) {
      return res.status(400).json({ error: 'Invalid entityId format' })
    }

    const parsedLimit = sanitizeNumber(limit, { min: 1, max: 100, default: 50 })
    const parsedOffset = sanitizeNumber(offset, { min: 0, max: 10000, default: 0 })

    const params: AuditQueryParams = {
      userId: userId as string | undefined,
      action: sanitizeString(action, { maxLength: 50 }) as AuditQueryParams['action'],
      entityType: sanitizeString(entityType, { maxLength: 50 }) as AuditQueryParams['entityType'],
      entityId: entityId as string | undefined,
      since: since as string | undefined,
      until: until as string | undefined,
      limit: parsedLimit,
      offset: parsedOffset,
    }

    const db = createDb()
    const result = await queryAuditLogs(db, params)

    // Short cache — audit data changes frequently
    res.setHeader('Cache-Control', 'private, no-cache')

    return res.status(200).json(result)
  } catch (error) {
    console.error('Error fetching audit logs:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

export default withSecurity(handler, {
  rateLimit: 'api',
  auth: 'required',
  permission: 'audit:read',
  audit: {
    action: 'analytics:export',  // Track who's viewing audit logs
    entityType: 'system',
  },
})
