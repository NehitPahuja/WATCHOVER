import { createServer, IncomingMessage, ServerResponse } from 'http'
import { parse } from 'url'
import { resolve } from 'path'

// Load .env
import { readFileSync } from 'fs'
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

const routes: Record<string, () => Promise<any>> = {
  '/api/events': () => import('../../api/events/index.js'),
  '/api/events/[id]': () => import('../../api/events/[id].js'),
  '/api/predictions': () => import('../../api/predictions/index.js'),
  '/api/predictions/[id]': () => import('../../api/predictions/[id]/index.js'),
  '/api/predictions/[id]/vote': () => import('../../api/predictions/[id]/vote.js'),
  '/api/predictions/snapshots': () => import('../../api/predictions/snapshots.js'),
  '/api/keywords': () => import('../../api/keywords.js'),
  '/api/layers': () => import('../../api/layers.js'),
  '/api/audit-logs': () => import('../../api/audit-logs.js'),
  '/api/digest': () => import('./digest.js').then(m => ({
    default: async (req: any, res: any) => {
      if (req.method === 'GET') {
        const d = await m.getDigest(req.query.date)
        return res.status(200).json(d)
      } else if (req.method === 'POST') {
        const d = await m.regenerateDigest()
        return res.status(200).json(d)
      }
    }
  }))
}

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  const url = parse(req.url || '/', true)
  const path = url.pathname || ''

  // Polyfill Vercel Response
  const vRes = res as any
  vRes.status = (code: number) => { vRes.statusCode = code; return vRes }
  vRes.send = (data: any) => { vRes.end(data); return vRes }
  vRes.json = (data: any) => {
    vRes.setHeader('Content-Type', 'application/json')
    vRes.end(JSON.stringify(data))
    return vRes
  }

  // Polyfill Vercel Request
  const vReq = req as any
  vReq.query = url.query || {}
  
  // CORS
  vRes.setHeader('Access-Control-Allow-Origin', '*')
  vRes.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  vRes.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') {
    return vRes.status(204).end()
  }

  // Parse Body
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
    let body = ''
    req.on('data', chunk => { body += chunk })
    await new Promise(resolve => req.on('end', resolve))
    try { vReq.body = JSON.parse(body) } catch { vReq.body = {} }
  }

  // Route matching
  let matchedHandler = null

  if (routes[path]) {
    matchedHandler = await routes[path]()
  } else if (path.startsWith('/api/events/') && path.split('/').length === 4) {
    vReq.query.id = path.split('/')[3]
    matchedHandler = await routes['/api/events/[id]']()
  } else if (path.startsWith('/api/predictions/') && path.endsWith('/vote')) {
    vReq.query.id = path.split('/')[3]
    matchedHandler = await routes['/api/predictions/[id]/vote']()
  } else if (path.startsWith('/api/predictions/') && path.split('/').length === 4) {
    vReq.query.id = path.split('/')[3]
    matchedHandler = await routes['/api/predictions/[id]']()
  }

  if (matchedHandler) {
    try {
      await matchedHandler.default(vReq, vRes)
    } catch (err: any) {
      console.error('[DEV API] Error handling', path, err)
      if (!vRes.headersSent) {
        vRes.status(500).json({ error: 'Internal Server Error', message: err.message })
      }
    }
  } else {
    // Proxy to digest standalone functions if matched
    if (path.startsWith('/api/digest')) {
      matchedHandler = await routes['/api/digest']()
      await matchedHandler.default(vReq, vRes)
    } else {
      vRes.status(404).json({ error: 'Not found' })
    }
  }
})

const port = process.env.API_PORT ? parseInt(process.env.API_PORT) : 3000
server.listen(port, () => {
  console.log(`[DEV API] Local API server running on http://localhost:${port}`)
})
