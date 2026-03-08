import {
  pgTable,
  uuid,
  text,
  varchar,
  timestamp,
  integer,
  real,
  boolean,
  jsonb,
  pgEnum,
} from 'drizzle-orm/pg-core'

// =============================================
// Enums
// =============================================

export const severityEnum = pgEnum('severity', ['critical', 'high', 'medium', 'low'])
export const sentimentEnum = pgEnum('sentiment', ['escalation', 'de-escalation', 'neutral'])
export const predictionStatusEnum = pgEnum('prediction_status', ['active', 'closed', 'resolved'])
export const voteSideEnum = pgEnum('vote_side', ['yes', 'no'])
export const subscriptionTierEnum = pgEnum('subscription_tier', ['free', 'analyst', 'command'])
export const subscriptionStatusEnum = pgEnum('subscription_status', ['active', 'cancelled', 'past_due', 'trialing'])
export const notificationTypeEnum = pgEnum('notification_type', ['event_alert', 'prediction_status', 'system_alert'])

// =============================================
// Users & Organizations
// =============================================

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  clerkId: varchar('clerk_id', { length: 255 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull(),
  displayName: varchar('display_name', { length: 255 }),
  avatarUrl: text('avatar_url'),
  role: varchar('role', { length: 50 }).notNull().default('viewer'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// =============================================
// Events (Core Intelligence Feed)
// =============================================

export const events = pgTable('events', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: varchar('title', { length: 500 }).notNull(),
  summary: text('summary'),
  region: varchar('region', { length: 100 }),
  country: varchar('country', { length: 100 }),
  countryCode: varchar('country_code', { length: 3 }),
  lat: real('lat'),
  lng: real('lng'),
  severity: severityEnum('severity').notNull().default('medium'),
  sentiment: sentimentEnum('sentiment').notNull().default('neutral'),
  confidence: integer('confidence').notNull().default(50),
  category: varchar('category', { length: 100 }),
  sourceRefs: jsonb('source_refs').$type<string[]>().default([]),
  isLive: boolean('is_live').notNull().default(true),
  publishedAt: timestamp('published_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const eventSources = pgTable('event_sources', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  url: text('url'),
  credibility: integer('credibility'),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// =============================================
// Map Layers
// =============================================

export const layers = pgTable('layers', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  description: text('description'),
  dataSourceUrl: text('data_source_url'),
  layerType: varchar('layer_type', { length: 50 }).notNull(),
  isActive: boolean('is_active').notNull().default(true),
  config: jsonb('config').$type<Record<string, unknown>>().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// =============================================
// Predictions (Forecasting Module)
// =============================================

export const predictions = pgTable('predictions', {
  id: uuid('id').primaryKey().defaultRandom(),
  question: text('question').notNull(),
  description: text('description'),
  category: varchar('category', { length: 100 }),
  closesAt: timestamp('closes_at', { withTimezone: true }).notNull(),
  resolutionRules: text('resolution_rules'),
  status: predictionStatusEnum('status').notNull().default('active'),
  isFeatured: boolean('is_featured').notNull().default(false),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const predictionVotes = pgTable('prediction_votes', {
  id: uuid('id').primaryKey().defaultRandom(),
  predictionId: uuid('prediction_id').notNull().references(() => predictions.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id),
  side: voteSideEnum('side').notNull(),
  weight: real('weight').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const predictionSnapshots = pgTable('prediction_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  predictionId: uuid('prediction_id').notNull().references(() => predictions.id, { onDelete: 'cascade' }),
  probabilityYes: real('probability_yes').notNull(),
  totalVotes: integer('total_votes').notNull().default(0),
  snapshotAt: timestamp('snapshot_at', { withTimezone: true }).notNull().defaultNow(),
})

// =============================================
// Subscriptions & Billing
// =============================================

export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
  stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }),
  tier: subscriptionTierEnum('tier').notNull().default('free'),
  status: subscriptionStatusEnum('status').notNull().default('active'),
  currentPeriodStart: timestamp('current_period_start', { withTimezone: true }),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// =============================================
// Notifications
// =============================================

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: notificationTypeEnum('type').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  message: text('message').notNull(),
  link: text('link'),
  isRead: boolean('is_read').notNull().default(false),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const notificationPreferences = pgTable('notification_preferences', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  eventAlerts: boolean('event_alerts').notNull().default(true),
  predictionUpdates: boolean('prediction_updates').notNull().default(true),
  systemAlerts: boolean('system_alerts').notNull().default(true),
  watchedRegions: jsonb('watched_regions').$type<string[]>().default([]),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// =============================================
// Audit Logs
// =============================================

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id),
  action: varchar('action', { length: 100 }).notNull(),
  entityType: varchar('entity_type', { length: 50 }).notNull(),
  entityId: uuid('entity_id'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
  ipAddress: varchar('ip_address', { length: 45 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
