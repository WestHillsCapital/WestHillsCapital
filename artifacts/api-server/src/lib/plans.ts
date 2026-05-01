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
