/**
 * Seed script for prediction data.
 *
 * Populates the predictions table with initial prediction questions
 * and generates historical snapshot data for chart display.
 *
 * Usage: npx tsx server/scripts/seed-predictions.ts
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'

// Load .env manually since dotenv isn't a dependency
const envPath = resolve(process.cwd(), '.env')
try {
  const envContent = readFileSync(envPath, 'utf-8')
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    let val = trimmed.slice(eqIdx + 1).trim()
    // strip surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = val
  }
} catch { /* no .env file — rely on system env */ }

import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { count } from 'drizzle-orm'
import * as schema from '../db/schema'

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable is not set')
    process.exit(1)
  }

  const sql = neon(databaseUrl)
  const db = drizzle(sql, { schema })

  console.log('🌱 Seeding predictions...\n')

  // Check if predictions already exist
  const [existing] = await db
    .select({ total: count() })
    .from(schema.predictions)

  if (Number(existing?.total) > 0) {
    console.log(`ℹ️  ${existing?.total} predictions already exist. Skipping seed.`)
    console.log('   To re-seed, delete existing predictions first.\n')
    return
  }

  // Prediction seed data
  const seedPredictions = [
    {
      question: 'Will there be a new ceasefire agreement by Q2 2026?',
      description: 'This prediction tracks the likelihood of any formal ceasefire agreement being signed in the ongoing Eastern European conflict before the end of Q2 2026. Ceasefire must be agreed upon by both primary belligerent parties and recognized by at least one international body (e.g., UN, OSCE).',
      category: 'MIL',
      closesAt: new Date('2026-06-30T23:59:00Z'),
      resolutionRules: 'This prediction resolves YES if a formal ceasefire agreement is signed by both primary belligerent parties and acknowledged by at least one major international organization (UN, OSCE, EU) before June 30, 2026, 23:59 UTC. Temporary humanitarian ceasefires or unilateral declarations do not count.',
      status: 'active' as const,
      isFeatured: true,
      targetProb: 62,
    },
    {
      question: 'Will NATO invoke Article 5 this year?',
      description: 'Market on whether any NATO member state will trigger Article 5 (collective defense) during calendar year 2026.',
      category: 'POL',
      closesAt: new Date('2026-12-31T23:59:00Z'),
      resolutionRules: 'Resolves YES if any NATO member formally invokes Article 5 of the North Atlantic Treaty before December 31, 2026. The invocation must be officially confirmed by NATO\'s Secretary General or the North Atlantic Council.',
      status: 'active' as const,
      isFeatured: true,
      targetProb: 8,
    },
    {
      question: 'Will oil prices exceed $120/barrel by March?',
      description: 'Tracks Brent Crude oil futures. The price must reach or exceed $120 USD per barrel at any point during March 2026.',
      category: 'ECN',
      closesAt: new Date('2026-03-31T23:59:00Z'),
      resolutionRules: 'Resolves YES if Brent Crude oil futures (front-month contract) reach or exceed $120.00 USD per barrel on any major commodity exchange at any point between March 1-31, 2026 UTC.',
      status: 'active' as const,
      isFeatured: false,
      targetProb: 34,
    },
    {
      question: 'Will sanctions be lifted on Iran by 2027?',
      description: 'Tracks whether the US and/or EU will substantially lift or waive major economic sanctions against Iran.',
      category: 'DIP',
      closesAt: new Date('2027-01-01T00:00:00Z'),
      resolutionRules: 'Resolves YES if the United States or the European Union formally lifts or waives at least 50% of currently active economic sanctions on Iran before January 1, 2027.',
      status: 'active' as const,
      isFeatured: false,
      targetProb: 21,
    },
    {
      question: 'Will there be a major cyber attack on Western infrastructure?',
      description: 'Tracks the likelihood of a significant state-sponsored cyber attack targeting critical infrastructure (power grid, financial systems, telecommunications) in NATO member states.',
      category: 'MIL',
      closesAt: new Date('2026-09-30T23:59:00Z'),
      resolutionRules: 'Resolves YES if a cyber attack causes service disruption affecting more than 500,000 people in any NATO member state and is attributed to a state actor by at least two independent cybersecurity firms.',
      status: 'active' as const,
      isFeatured: false,
      targetProb: 47,
    },
    {
      question: 'Will the UN General Assembly pass a resolution on AI weapons?',
      description: 'Tracks whether the UN General Assembly will adopt a binding or non-binding resolution specifically addressing autonomous weapons systems (AWS) powered by AI.',
      category: 'POL',
      closesAt: new Date('2026-12-15T23:59:00Z'),
      resolutionRules: 'Resolves YES if the UN General Assembly adopts any resolution (binding or non-binding) that specifically addresses autonomous weapons systems and artificial intelligence in military applications before December 15, 2026.',
      status: 'active' as const,
      isFeatured: false,
      targetProb: 55,
    },
  ]

  for (const seed of seedPredictions) {
    const { targetProb, ...predData } = seed

    // Insert prediction
    const [inserted] = await db
      .insert(schema.predictions)
      .values(predData)
      .returning({ id: schema.predictions.id })

    console.log(`  ✅ Created: "${predData.question.slice(0, 50)}..." (${inserted.id})`)

    // Generate 90 days of historical snapshots
    const now = new Date()
    let value = Math.max(5, Math.min(95, targetProb - 15 + Math.random() * 10))

    for (let i = 90; i >= 0; i--) {
      const snapshotDate = new Date(now)
      snapshotDate.setDate(snapshotDate.getDate() - i)

      const drift = (Math.random() - 0.48) * 3
      value = Math.max(2, Math.min(98, value + drift))

      // Make the last point match the target
      if (i === 0) value = targetProb

      await db.insert(schema.predictionSnapshots).values({
        predictionId: inserted.id,
        probabilityYes: Math.round(value * 10) / 10,
        totalVotes: Math.floor(Math.random() * 50) + 10,
        snapshotAt: snapshotDate,
      })
    }

    console.log(`     📈 Generated 91 snapshots`)
  }

  console.log(`\n🎉 Successfully seeded ${seedPredictions.length} predictions with historical data!`)
}

main().catch((err) => {
  console.error('❌ Seed failed:', err)
  process.exit(1)
})
