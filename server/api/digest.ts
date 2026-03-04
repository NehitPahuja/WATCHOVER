/**
 * Smart Digest API Endpoint
 *
 * GET /api/digest — Returns the latest cached AI briefing
 * POST /api/digest/generate — Forces regeneration (admin only)
 *
 * For Vercel serverless deployment.
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'

// Load .env
try {
  const envPath = resolve(process.cwd(), '.env')
  const envContent = readFileSync(envPath, 'utf-8')
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIndex = trimmed.indexOf('=')
    if (eqIndex === -1) continue
    const key = trimmed.slice(0, eqIndex).trim()
    let value = trimmed.slice(eqIndex + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = value
  }
} catch {}

import { generateSmartDigest, getCachedDigest } from '../services/ai-digest'

/**
 * Get the latest digest (from cache or generate on the fly).
 */
export async function getDigest(date?: string) {
  // Try cache first
  const cached = await getCachedDigest(date)
  if (cached) return cached

  // Not cached — generate fresh
  return generateSmartDigest(undefined, false)
}

/**
 * Force re-generate the digest.
 */
export async function regenerateDigest() {
  return generateSmartDigest(undefined, true)
}

// =============================================
// Standalone test server
// =============================================

if (process.argv[1]?.includes('digest')) {
  const port = parseInt(process.env.DIGEST_API_PORT || '3001', 10)

  import('http').then(({ createServer }) => {
    const server = createServer(async (req, res) => {
      // CORS
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

      if (req.method === 'OPTIONS') {
        res.writeHead(204)
        res.end()
        return
      }

      const url = new URL(req.url || '/', `http://localhost:${port}`)

      try {
        if (url.pathname === '/api/digest' && req.method === 'GET') {
          const date = url.searchParams.get('date') || undefined
          const digest = await getDigest(date)
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify(digest))
        } else if (url.pathname === '/api/digest/generate' && req.method === 'POST') {
          const digest = await regenerateDigest()
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify(digest))
        } else {
          res.writeHead(404, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Not found' }))
        }
      } catch (err) {
        console.error('[DIGEST API] Error:', err)
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Internal server error' }))
      }
    })

    server.listen(port, () => {
      console.log(`[DIGEST API] Serving on http://localhost:${port}`)
      console.log(`  GET  /api/digest           — Fetch latest digest`)
      console.log(`  POST /api/digest/generate   — Force regeneration`)
    })
  })
}
