export type PlanTier = "free" | "starter" | "starter_esign" | "pro" | "developer" | "enterprise";

export interface PlanLimits {
  maxPackages:            number | null;
  maxSubmissionsPerMonth: number | null;
  submissionsPerSeat:     number | null;
  maxSeats:               number;
}

export interface PlanFeatures {
  clientLinks:              boolean;
  csvBatch:                 boolean;
  googleDrive:              boolean;
  hubspot:                  boolean;
  eSign:                    boolean;
  emailBranding:            boolean;
  webhooks:                 boolean;
  apiAccess:                boolean;
  embeddedInterviews:       boolean;
  customDomain:             boolean;
  fieldLibraryInheritance:  boolean;
  samlSso:                  boolean;
}

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  free: {
    maxPackages:            1,
    maxSubmissionsPerMonth: 3,
    submissionsPerSeat:     3,
    maxSeats:               1,
  },
  starter: {
    maxPackages:            5,
    maxSubmissionsPerMonth: 150,
    submissionsPerSeat:     75,
    maxSeats:               2,
  },
  starter_esign: {
    maxPackages:            5,
    maxSubmissionsPerMonth: 150,
    submissionsPerSeat:     75,
    maxSeats:               2,
  },
  pro: {
    maxPackages:            null,
    maxSubmissionsPerMonth: 400,
    submissionsPerSeat:     40,
    maxSeats:               10,
  },
  developer: {
    maxPackages:            null,
    maxSubmissionsPerMonth: null, // generation-based billing — no session cap
    submissionsPerSeat:     null, // org-wide, unlimited seats
    maxSeats:               9999,
  },
  enterprise: {
    maxPackages:            null,
    maxSubmissionsPerMonth: null,
    submissionsPerSeat:     null,
    maxSeats:               25,
  },
};

export const PLAN_FEATURES: Record<PlanTier, PlanFeatures> = {
  free: {
    clientLinks:              false,
    csvBatch:                 false,
    googleDrive:              false,
    hubspot:                  false,
    eSign:                    false,
    emailBranding:            false,
    webhooks:                 false,
    apiAccess:                false,
    embeddedInterviews:       false,
    customDomain:             false,
    fieldLibraryInheritance:  false,
    samlSso:                  false,
  },
  starter: {
    clientLinks:              false,
    csvBatch:                 false,
    googleDrive:              false,
    hubspot:                  false,
    eSign:                    false,
    emailBranding:            false,
    webhooks:                 false,
    apiAccess:                false,
    embeddedInterviews:       false,
    customDomain:             false,
    fieldLibraryInheritance:  false,
    samlSso:                  false,
  },
  starter_esign: {
    clientLinks:              true,
    csvBatch:                 false,
    googleDrive:              false,
    hubspot:                  false,
    eSign:                    true,
    emailBranding:            false,
    webhooks:                 false,
    apiAccess:                false,
    embeddedInterviews:       false,
    customDomain:             false,
    fieldLibraryInheritance:  false,
    samlSso:                  false,
  },
  pro: {
    clientLinks:              true,
    csvBatch:                 true,
    googleDrive:              true,
    hubspot:                  true,
    eSign:                    true,
    emailBranding:            true,
    webhooks:                 false,
    apiAccess:                false,
    embeddedInterviews:       false,
    customDomain:             false,
    fieldLibraryInheritance:  false,
    samlSso:                  false,
  },
  developer: {
    clientLinks:              true,
    csvBatch:                 true,
    googleDrive:              true,
    hubspot:                  true,
    eSign:                    true,
    emailBranding:            true,
    webhooks:                 true,
    apiAccess:                true,
    embeddedInterviews:       true,
    customDomain:             false,
    fieldLibraryInheritance:  false,
    samlSso:                  false,
  },
  enterprise: {
    clientLinks:              true,
    csvBatch:                 true,
    googleDrive:              true,
    hubspot:                  true,
    eSign:                    true,
    emailBranding:            true,
    webhooks:                 true,
    apiAccess:                true,
    embeddedInterviews:       true,
    customDomain:             true,
    fieldLibraryInheritance:  true,
    samlSso:                  true,
  },
};

/**
 * Normalize a raw DB plan_tier value to a canonical PlanTier.
 * "starter_esign" is a terminated tier — existing accounts are silently
 * treated as "starter" for limits and feature gating.
 * Any unknown value falls through to "free".
 */
function normalizeTier(tier: string): PlanTier {
  if (tier === "free")       return "free";
  if (tier === "pro")        return "pro";
  if (tier === "developer")  return "developer";
  if (tier === "enterprise") return "enterprise";
  if (tier === "starter" || tier === "starter_esign") return "starter";
  return "free"; // unknown values default to free (most restrictive)
}

export function getPlanLimits(tier: string): PlanLimits {
  return PLAN_LIMITS[normalizeTier(tier)];
}

/**
 * Returns the effective monthly submission limit for an account, factoring
 * in the actual number of seats (base plan seats + any purchased extra seats).
 * Returns null for Enterprise/Developer (unlimited).
 * For plans with a maxSubmissionsPerMonth hard cap (e.g. Free), that cap is
 * used directly regardless of seat count to prevent accidental overages.
 */
export function getEffectiveSubmissionLimit(tier: string, actualSeatLimit: number): number | null {
  const limits = getPlanLimits(tier);
  if (limits.submissionsPerSeat === null) return null;
  const seatBased = actualSeatLimit * limits.submissionsPerSeat;
  // Respect a hard monthly cap when set (Free tier uses this to stay at 3)
  if (limits.maxSubmissionsPerMonth !== null) {
    return Math.min(seatBased, limits.maxSubmissionsPerMonth);
  }
  return seatBased;
}

export function getPlanFeatures(tier: string): PlanFeatures {
  return PLAN_FEATURES[normalizeTier(tier)];
}

function isPlanTier(value: unknown): value is PlanTier {
  return value === "starter" || value === "starter_esign" || value === "free" || value === "pro" || value === "developer" || value === "enterprise";
}

export interface SubmissionPackTier {
  size:        number;
  monthly:     number;
  annual:      number;
  annualPerMo: number;
}

/**
 * Available submission pack sizes and their prices.
 * One-off price equals the monthly price.
 * Annual = monthly * 12 * 0.8 (20% off), frontloaded on purchase.
 */
export const SUBMISSION_PACKS: SubmissionPackTier[] = [
  { size:    50, monthly:  25, annual:   240, annualPerMo:  20 },
  { size:   100, monthly:  45, annual:   432, annualPerMo:  36 },
  { size:   300, monthly: 120, annual:  1152, annualPerMo:  96 },
  { size:   500, monthly: 185, annual:  1776, annualPerMo: 148 },
  { size:  1000, monthly: 349, annual:  3348, annualPerMo: 279 },
];

export function getPackTier(size: number): SubmissionPackTier | undefined {
  return SUBMISSION_PACKS.find((p) => p.size === size);
}

export interface GenerationPackTier {
  size:        number; // number of extra PDF generations in the pack
  monthly:     number; // monthly price in USD
  annual:      number; // annual price in USD (paid upfront; 20% off monthly×12)
  annualPerMo: number; // annual price expressed as per-month equivalent
}

/**
 * Available generation pack sizes and their prices for Developer plan accounts.
 * Monthly price equals the $0.75/generation overage rate — no monthly discount,
 * just price predictability. The 20% discount applies to annual commitment only.
 * Annual = monthly × 12 × 0.8 (20% off), paid upfront.
 *
 * | Pack  | Monthly    | Annual (paid upfront) | Annual /mo |
 * |-------|------------|-----------------------|------------|
 * |   100 |  $75/mo    |   $720/yr             |  $60/mo    |
 * |   500 | $375/mo    | $3,600/yr             | $300/mo    |
 * |  1000 | $750/mo    | $7,200/yr             | $600/mo    |
 * |  2500 |$1,875/mo   |$18,000/yr             |$1,500/mo   |
 */
export const GENERATION_PACKS: GenerationPackTier[] = [
  { size:  100, monthly:    75, annual:    720, annualPerMo:    60 },
  { size:  500, monthly:   375, annual:  3_600, annualPerMo:   300 },
  { size: 1000, monthly:   750, annual:  7_200, annualPerMo:   600 },
  { size: 2500, monthly: 1_875, annual: 18_000, annualPerMo: 1_500 },
];

export function getGenerationPackTier(size: number): GenerationPackTier | undefined {
  return GENERATION_PACKS.find((p) => p.size === size);
}

/** Number of PDF generations included in the Developer plan each billing period. */
export const DEVELOPER_INCLUDED_GENERATIONS = 500;

/**
 * Human-readable display names for plan tier slugs.
 * The internal slug "starter_esign" maps to "Starter Professional" for all
 * customer-facing surfaces. Add entries here whenever a new tier is introduced.
 */
export const PLAN_DISPLAY_NAMES: Record<string, string> = {
  starter:        "Starter",
  starter_esign:  "Starter Professional",
  pro:            "Pro",
  developer:      "Developer",
  enterprise:     "Enterprise",
  free:           "Free",
};

/**
 * Returns the customer-facing display name for a plan tier slug.
 * Falls back to the raw slug when no mapping is found.
 */
export function getPlanDisplayName(tier: string): string {
  return PLAN_DISPLAY_NAMES[tier] ?? tier;
}

/**
 * Normalises a Stripe product name to its canonical customer-facing display
 * name. Used to rewrite legacy names (e.g. "Starter + eSign") that may still
 * appear on Stripe products before they are renamed there.
 */
export function normalizeStripeProductName(productName: string): string {
  if (productName === "Starter + eSign" || productName === "starter_esign") {
    return "Starter Professional";
  }
  return productName;
}
