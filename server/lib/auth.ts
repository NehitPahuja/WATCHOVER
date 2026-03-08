/**
 * Auth utilities for API routes.
 * Uses Clerk for authentication and RBAC.
 */

/** User roles matching the PRD's RBAC matrix */
export type UserRole = 'admin' | 'subscriber' | 'viewer'

/** Decoded user session from auth token */
export interface AuthSession {
  userId: string
  clerkId: string
  email: string
  role: UserRole
  subscriptionTier: 'free' | 'analyst' | 'command'
}

/**
 * Permission matrix (from PRD §5.8)
 *
 * Admin       → Full access
 * Subscriber  → Vote on predictions, view Smart Digest, full feed
 * Viewer      → Public feed, limited predictions (view only)
 */
export const PERMISSIONS = {
  'events:read': ['admin', 'subscriber', 'viewer'],
  'events:write': ['admin'],
  'predictions:read': ['admin', 'subscriber', 'viewer'],
  'predictions:vote': ['admin', 'subscriber'],
  'analytics:read': ['admin', 'subscriber'],
  'analytics:export': ['admin'],
  'digest:read': ['admin', 'subscriber'],
  'layers:manage': ['admin'],
  'users:manage': ['admin'],
  'audit:read': ['admin'],
} as const

export type Permission = keyof typeof PERMISSIONS

/**
 * Check if a role has a specific permission.
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  const allowedRoles = PERMISSIONS[permission]
  return (allowedRoles as readonly string[]).includes(role)
}

/**
 * Verify auth token and return session.
 * In production, this verifies the Clerk JWT.
 *
 * Usage in API handlers:
 *   const session = await verifyAuth(request)
 *   if (!session) return new Response('Unauthorized', { status: 401 })
 *   if (!hasPermission(session.role, 'predictions:vote'))
 *     return new Response('Forbidden', { status: 403 })
 */
export async function verifyAuth(request: any): Promise<AuthSession | null> {
  const getHeader = (name: string) => 
    typeof request.headers?.get === 'function' 
      ? request.headers.get(name) || request.headers.get(name.toLowerCase()) 
      : request.headers?.[name.toLowerCase()]

  const authHeader = getHeader('Authorization') as string | undefined
  if (!authHeader?.startsWith('Bearer ')) return null

  const token = authHeader.slice(7)

  try {
    // In production: verify the Clerk JWT using @clerk/backend
    // For now, this is a placeholder that should be replaced with:
    //
    //   import { verifyToken } from '@clerk/backend'
    //   const payload = await verifyToken(token, {
    //     secretKey: process.env.CLERK_SECRET_KEY!,
    //   })
    //
    // Then look up the user in our database:
    //   const user = await db.select().from(schema.users)
    //     .where(eq(schema.users.clerkId, payload.sub))
    //     .limit(1)

    // Placeholder — remove in production
    console.log('Auth token received:', token.slice(0, 10) + '...')
    return null
  } catch {
    return null
  }
}
