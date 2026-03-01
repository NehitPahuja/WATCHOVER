import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'

/**
 * Create a database client instance.
 * Uses Neon's HTTP driver for serverless/edge compatibility.
 *
 * Usage:
 *   const db = createDb()
 *   const events = await db.select().from(schema.events).limit(10)
 */
export function createDb() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is not set')
  }

  const sql = neon(databaseUrl)
  return drizzle(sql, { schema })
}

export type Database = ReturnType<typeof createDb>
