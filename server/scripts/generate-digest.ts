/**
 * Smart Digest Generation Script
 *
 * Generates the daily AI-powered intelligence briefing.
 * Can be run manually or via cron job.
 *
 * Usage: npx tsx server/scripts/generate-digest.ts
 * Options:
 *   --force    Regenerate even if cached digest exists
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'

// Load .env manually
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

import { generateSmartDigest } from '../services/ai-digest'

async function main() {
  const forceRefresh = process.argv.includes('--force')

  console.log('🧠 WatchOver Smart Digest Generator')
  console.log('====================================')
  console.log(`Date: ${new Date().toISOString().split('T')[0]}`)
  console.log(`Force refresh: ${forceRefresh}`)
  console.log()

  const digest = await generateSmartDigest(undefined, forceRefresh)

  console.log()
  console.log('📋 GENERATED DIGEST')
  console.log('====================================')
  console.log(`Provider: ${digest.provider}`)
  console.log(`Threat Level: ${digest.threatLevel.toUpperCase()}`)
  console.log(`Events Analyzed: ${digest.eventsAnalyzed}`)
  console.log()
  console.log(`HEADLINE: ${digest.headline}`)
  console.log()
  console.log('KEY POINTS:')
  digest.keyPoints.forEach(p => console.log(`  • ${p}`))
  console.log()
  console.log('REGIONS OF CONCERN:')
  console.log(`  ${digest.regionsOfConcern.join(', ') || 'None identified'}`)
  console.log()
  console.log('ANALYSIS:')
  console.log(digest.body)
  console.log()
  console.log('====================================')
  console.log(`✅ Digest generated and cached at ${digest.generatedAt}`)
}

main().catch((err) => {
  console.error('❌ Digest generation failed:', err)
  process.exit(1)
})
