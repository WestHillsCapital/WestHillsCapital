export type PlanTier = "starter" | "pro" | "enterprise";

export interface PlanLimits {
  maxPackages:            number | null;
  maxSubmissionsPerMonth: number | null;
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
    maxSeats:               2,
  },
  pro: {
    maxPackages:            null,
    maxSubmissionsPerMonth: 500,
    maxSeats:               10,
  },
  enterprise: {
    maxPackages:            null,
    maxSubmissionsPerMonth: null,
    maxSeats:               999,
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

export function getPlanFeatures(tier: string): PlanFeatures {
  return PLAN_FEATURES[normalizeTier(tier)];
}

export function isPlanTier(value: unknown): value is PlanTier {
  return value === "starter" || value === "free" || value === "pro" || value === "enterprise";
}
