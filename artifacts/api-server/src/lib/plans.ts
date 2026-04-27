export type PlanTier = "free" | "pro" | "enterprise";

export interface PlanLimits {
  maxPackages:        number | null;
  maxSubmissionsPerMonth: number | null;
  maxSeats:           number;
}

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  free: {
    maxPackages:            3,
    maxSubmissionsPerMonth: 50,
    maxSeats:               1,
  },
  pro: {
    maxPackages:            null,
    maxSubmissionsPerMonth: 500,
    maxSeats:               5,
  },
  enterprise: {
    maxPackages:            null,
    maxSubmissionsPerMonth: null,
    maxSeats:               999,
  },
};

export function getPlanLimits(tier: string): PlanLimits {
  const t = tier as PlanTier;
  return PLAN_LIMITS[t] ?? PLAN_LIMITS.free;
}

export function isPlanTier(value: unknown): value is PlanTier {
  return value === "free" || value === "pro" || value === "enterprise";
}
