/**
 * @workspace/plan-data
 *
 * Single source of truth for Docuplete plan pricing, limits, and features
 * for all customer-facing surfaces (app settings, marketing site, docs).
 *
 * The API server (artifacts/api-server/src/lib/plans.ts) enforces the actual
 * runtime limits. Keep both files in sync when changing plan definitions.
 */

export type PlanKey = "starter" | "pro" | "developer" | "enterprise";

export interface PlanData {
  name:                     string;
  priceMonthly:             number;
  maxPackages:              number | null;
  maxSubmissionsPerMonth:   number | null;
  submissionsLabel:         string;
  maxSeats:                 number | null;
  seatsLabel:               string;
  overage:                  string;
  eSign:                    boolean;
  clientLinks:              boolean;
  csvBatch:                 boolean;
  apiAccess:                boolean;
  webhooks:                 boolean;
  customDomain:             boolean;
  samlSso:                  boolean;
}

export const PLAN_DATA: Record<PlanKey, PlanData> = {
  starter: {
    name:                   "Starter",
    priceMonthly:           69,
    maxPackages:            5,
    maxSubmissionsPerMonth: 150,
    submissionsLabel:       "150 sessions / mo",
    maxSeats:               2,
    seatsLabel:             "2 seats",
    overage:                "Overage: $0.50 / additional session",
    eSign:                  true,
    clientLinks:            false,
    csvBatch:               false,
    apiAccess:              false,
    webhooks:               false,
    customDomain:           false,
    samlSso:                false,
  },
  pro: {
    name:                   "Pro",
    priceMonthly:           249,
    maxPackages:            null,
    maxSubmissionsPerMonth: 400,
    submissionsLabel:       "400 sessions / mo",
    maxSeats:               10,
    seatsLabel:             "10 seats",
    overage:                "Overage: $0.50 / additional session",
    eSign:                  true,
    clientLinks:            true,
    csvBatch:               true,
    apiAccess:              false,
    webhooks:               false,
    customDomain:           false,
    samlSso:                false,
  },
  developer: {
    name:                   "Developer",
    priceMonthly:           499,
    maxPackages:            null,
    maxSubmissionsPerMonth: null,
    submissionsLabel:       "500 PDF generations / mo",
    maxSeats:               null,
    seatsLabel:             "Org-wide API access",
    overage:                "Overage: $75 / block of 100 generations",
    eSign:                  true,
    clientLinks:            true,
    csvBatch:               true,
    apiAccess:              true,
    webhooks:               true,
    customDomain:           false,
    samlSso:                false,
  },
  enterprise: {
    name:                   "Enterprise",
    priceMonthly:           3000,
    maxPackages:            null,
    maxSubmissionsPerMonth: null,
    submissionsLabel:       "Unlimited PDF generations",
    maxSeats:               25,
    seatsLabel:             "25 seats",
    overage:                "$15 / extra seat",
    eSign:                  true,
    clientLinks:            true,
    csvBatch:               true,
    apiAccess:              true,
    webhooks:               true,
    customDomain:           true,
    samlSso:                true,
  },
};

export const PLAN_KEYS: PlanKey[] = ["starter", "pro", "developer", "enterprise"];

/** Monthly-equivalent price at annual billing (20% off). */
export function annualMonthlyPrice(key: PlanKey): number {
  return Math.round(PLAN_DATA[key].priceMonthly * 0.8);
}

/** Display price for a given billing interval. */
export function planDisplayPrice(key: PlanKey, interval: "monthly" | "annual"): number {
  return interval === "annual" ? annualMonthlyPrice(key) : PLAN_DATA[key].priceMonthly;
}
