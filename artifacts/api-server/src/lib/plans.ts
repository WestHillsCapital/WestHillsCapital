export type PlanTier = "starter" | "pro" | "enterprise";

export interface PlanLimits {
  maxPackages:            number | null;
  maxSubmissionsPerMonth: number | null;
  submissionsPerSeat:     number | null;
  maxSeats:               number;
}

export interface PlanFeatures {
  clientLinks:          boolean;
  csvBatch:             boolean;
  googleDrive:          boolean;
  hubspot:              boolean;
  eSign:                boolean;
  emailBranding:        boolean;
  webhooks:             boolean;
  apiAccess:            boolean;
  embeddedInterviews:   boolean;
  customDomain:         boolean;
}

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  starter: {
    maxPackages:            5,
    maxSubmissionsPerMonth: 100,
    submissionsPerSeat:     50,
    maxSeats:               2,
  },
  pro: {
    maxPackages:            null,
    maxSubmissionsPerMonth: 500,
    submissionsPerSeat:     50,
    maxSeats:               10,
  },
  enterprise: {
    maxPackages:            null,
    maxSubmissionsPerMonth: null,
    submissionsPerSeat:     null,
    maxSeats:               25,
  },
};

export const PLAN_FEATURES: Record<PlanTier, PlanFeatures> = {
  starter: {
    clientLinks:          false,
    csvBatch:             false,
    googleDrive:          false,
    hubspot:              false,
    eSign:                false,
    emailBranding:        false,
    webhooks:             false,
    apiAccess:            false,
    embeddedInterviews:   false,
    customDomain:         false,
  },
  pro: {
    clientLinks:          true,
    csvBatch:             true,
    googleDrive:          true,
    hubspot:              true,
    eSign:                true,
    emailBranding:        true,
    webhooks:             false,
    apiAccess:            false,
    embeddedInterviews:   false,
    customDomain:         false,
  },
  enterprise: {
    clientLinks:          true,
    csvBatch:             true,
    googleDrive:          true,
    hubspot:              true,
    eSign:                true,
    emailBranding:        true,
    webhooks:             true,
    apiAccess:            true,
    embeddedInterviews:   true,
    customDomain:         true,
  },
};

/**
 * Normalize a raw DB plan_tier value to a canonical PlanTier.
 * "free" and any unknown value map to "starter" for backward compatibility.
 */
function normalizeTier(tier: string): PlanTier {
  if (tier === "pro")        return "pro";
  if (tier === "enterprise") return "enterprise";
  return "starter";
}

export function getPlanLimits(tier: string): PlanLimits {
  return PLAN_LIMITS[normalizeTier(tier)];
}

/**
 * Returns the effective monthly submission limit for an account, factoring
 * in the actual number of seats (base plan seats + any purchased extra seats).
 * Returns null for Enterprise (unlimited).
 */
export function getEffectiveSubmissionLimit(tier: string, actualSeatLimit: number): number | null {
  const limits = getPlanLimits(tier);
  if (limits.submissionsPerSeat === null) return null;
  return actualSeatLimit * limits.submissionsPerSeat;
}

export function getPlanFeatures(tier: string): PlanFeatures {
  return PLAN_FEATURES[normalizeTier(tier)];
}

export function isPlanTier(value: unknown): value is PlanTier {
  return value === "starter" || value === "free" || value === "pro" || value === "enterprise";
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
