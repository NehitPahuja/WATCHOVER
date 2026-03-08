/**
 * Audit Log Service
 *
 * Records all moderator, editor, and admin actions for
 * compliance, accountability, and forensic analysis.
 *
 * Schema: server/db/schema.ts → auditLogs table
 *
 * Actions tracked:
 * - Event create/update/delete
 * - Prediction create/resolve/close
 * - User role changes
 * - Layer management
 * - Digest regeneration
 * - Login / auth events
 *
 * Usage:
 *   import { logAuditEvent } from '../lib/audit'
 *   await logAuditEvent(db, {
 *     userId: session.userId,
 *     action: 'event:create',
 *     entityType: 'event',
 *     entityId: newEvent.id,
 *     metadata: { title: newEvent.title },
 *     ipAddress: req.headers['x-forwarded-for'],
 *   })
 */

import { type Database } from '../db'
import * as schema from '../db/schema'

// =============================================
// Audit Action Types
// =============================================

export type AuditAction =
  // Event actions
  | 'event:create'
  | 'event:update'
  | 'event:delete'
  | 'event:moderate'
  // Prediction actions
  | 'prediction:create'
  | 'prediction:update'
  | 'prediction:resolve'
  | 'prediction:close'
  | 'prediction:vote'
  // User actions
  | 'user:role_change'
  | 'user:suspend'
  | 'user:unsuspend'
  | 'user:delete'
  // Layer actions
  | 'layer:create'
  | 'layer:update'
  | 'layer:delete'
  | 'layer:toggle'
  // Digest actions
  | 'digest:regenerate'
  // Notification actions
  | 'notification:mark_read'
  | 'notification:update_preferences'
  // Analytics actions
  | 'analytics:export'
  // Auth actions
  | 'auth:login'
  | 'auth:logout'
  | 'auth:failed_login'
  // System actions
  | 'system:config_change'
  | 'system:rate_limit_override'

export type AuditEntityType =
  | 'event'
  | 'prediction'
  | 'user'
  | 'layer'
  | 'digest'
  | 'notification'
  | 'analytics'
  | 'system'

// =============================================
// Audit Log Entry Interface
// =============================================

export interface AuditLogEntry {
  userId?: string
  action: AuditAction
  entityType: AuditEntityType
  entityId?: string
  metadata?: Record<string, unknown>
  ipAddress?: string
}

// =============================================
// Core Audit Logger
// =============================================

/**
 * Log an audit event to the database.
 * This is fire-and-forget safe — errors are logged but won't break the caller.
 */
export async function logAuditEvent(
  db: Database,
  entry: AuditLogEntry
): Promise<void> {
  try {
    await db.insert(schema.auditLogs).values({
      userId: entry.userId || null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId || null,
      metadata: entry.metadata || {},
      ipAddress: entry.ipAddress || null,
    })
  } catch (error) {
    // Never let audit logging break the main flow
    console.error('[AUDIT] Failed to log audit event:', {
      action: entry.action,
      entityType: entry.entityType,
      error: error instanceof Error ? error.message : error,
    })
  }
}

/**
 * Log multiple audit events in a batch (for bulk operations).
 */
export async function logAuditBatch(
  db: Database,
  entries: AuditLogEntry[]
): Promise<void> {
  if (entries.length === 0) return

  try {
    await db.insert(schema.auditLogs).values(
      entries.map((entry) => ({
        userId: entry.userId || null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId || null,
        metadata: entry.metadata || {},
        ipAddress: entry.ipAddress || null,
      }))
    )
  } catch (error) {
    console.error('[AUDIT] Failed to log audit batch:', {
      count: entries.length,
      error: error instanceof Error ? error.message : error,
    })
  }
}

// =============================================
// Query Audit Logs
// =============================================

export interface AuditQueryParams {
  userId?: string
  action?: AuditAction
  entityType?: AuditEntityType
  entityId?: string
  since?: string      // ISO date string
  until?: string      // ISO date string
  limit?: number
  offset?: number
}

/**
 * Query audit logs with filtering. Admin-only endpoint.
 */
export async function queryAuditLogs(
  db: Database,
  params: AuditQueryParams
) {
  const {
    limit = 50,
    offset = 0,
  } = params

  // Use raw SQL via drizzle for flexible filtering
  const conditions: string[] = []
  const values: unknown[] = []
  let paramIndex = 1

  if (params.userId) {
    conditions.push(`user_id = $${paramIndex++}`)
    values.push(params.userId)
  }
  if (params.action) {
    conditions.push(`action = $${paramIndex++}`)
    values.push(params.action)
  }
  if (params.entityType) {
    conditions.push(`entity_type = $${paramIndex++}`)
    values.push(params.entityType)
  }
  if (params.entityId) {
    conditions.push(`entity_id = $${paramIndex++}`)
    values.push(params.entityId)
  }
  if (params.since) {
    conditions.push(`created_at >= $${paramIndex++}`)
    values.push(new Date(params.since))
  }
  if (params.until) {
    conditions.push(`created_at <= $${paramIndex++}`)
    values.push(new Date(params.until))
  }

  const whereClause = conditions.length > 0
    ? `WHERE ${conditions.join(' AND ')}`
    : ''

  // Use drizzle's select for type safety
  const { sql } = await import('drizzle-orm')

  const query = sql.raw(
    `SELECT * FROM audit_logs ${whereClause} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`
  )

  const result = await db.execute(query)

  // Get total count for pagination
  const countQuery = sql.raw(
    `SELECT COUNT(*) as total FROM audit_logs ${whereClause}`
  )
  const countResult = await db.execute(countQuery)
  const total = Number((countResult as unknown as Array<{ total: number }>)?.[0]?.total || 0)

  return {
    data: result as unknown as Array<{
      id: string
      user_id: string | null
      action: string
      entity_type: string
      entity_id: string | null
      metadata: Record<string, unknown>
      ip_address: string | null
      created_at: string
    }>,
    meta: {
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    },
  }
}

// =============================================
// Helper: Extract IP from Request
// =============================================

/**
 * Extract client IP from request headers (handles proxies).
 */
export function getClientIp(
  headers: Record<string, string | string[] | undefined>
): string {
  // Check X-Forwarded-For first (Vercel, Cloudflare, etc.)
  const forwarded = headers['x-forwarded-for']
  if (forwarded) {
    const ip = Array.isArray(forwarded)
      ? forwarded[0]
      : forwarded.split(',')[0]
    return ip?.trim() || 'unknown'
  }

  // Check X-Real-IP (nginx)
  const realIp = headers['x-real-ip']
  if (realIp) {
    return Array.isArray(realIp) ? realIp[0] : realIp
  }

  return 'unknown'
}
