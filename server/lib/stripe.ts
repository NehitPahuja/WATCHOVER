import Stripe from 'stripe'

/**
 * Create a Stripe client instance for server-side use.
 */
export function createStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY environment variable is not set')
  }

  return new Stripe(secretKey)
}

/**
 * Subscription tier configuration.
 * Maps internal tiers to Stripe price IDs.
 * Update these after creating products in the Stripe Dashboard.
 */
export const SUBSCRIPTION_TIERS = {
  free: {
    name: 'Observer',
    description: 'Basic access to public intelligence feed',
    priceId: null, // No Stripe price — free tier
    features: [
      'Public event feed',
      'Globe visualization',
      'Basic predictions (view only)',
      'Global Tension Index',
    ],
  },
  analyst: {
    name: 'Signal Clearance — Analyst',
    description: 'Full intelligence access with predictions voting',
    priceId: 'price_ANALYST_MONTHLY', // Replace with real Stripe price ID
    features: [
      'Everything in Observer',
      'Smart Digest (AI summaries)',
      'Vote on predictions',
      'Full analytics dashboard',
      'Keyword alerts',
      'Export reports',
    ],
  },
  command: {
    name: 'Signal Clearance — Command',
    description: 'Enterprise-grade intelligence suite',
    priceId: 'price_COMMAND_MONTHLY', // Replace with real Stripe price ID
    features: [
      'Everything in Analyst',
      'API access',
      'Custom data layers',
      'Priority data refresh',
      'Team management',
      'Audit logs',
    ],
  },
} as const

export type SubscriptionTier = keyof typeof SUBSCRIPTION_TIERS
