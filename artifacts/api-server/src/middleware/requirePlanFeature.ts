import type { Request, Response, NextFunction } from "express";
import { getDb } from "../db";
import { getPlanFeatures, type PlanFeatures } from "../lib/plans";
import { logger } from "../lib/logger";

export type PlanFeatureName = keyof PlanFeatures;

type FeatureMeta = { plan: "pro" | "enterprise"; label: string };

export const FEATURE_META: Record<PlanFeatureName, FeatureMeta> = {
  clientLinks:          { plan: "pro",        label: "Client-facing links" },
  csvBatch:             { plan: "pro",        label: "CSV batch processing" },
  googleDrive:          { plan: "pro",        label: "Google Drive integration" },
  hubspot:              { plan: "pro",        label: "HubSpot integration" },
  eSign:                { plan: "pro",        label: "eSign" },
  emailBranding:        { plan: "pro",        label: "Custom email branding" },
  webhooks:             { plan: "enterprise", label: "Webhooks" },
  apiAccess:            { plan: "enterprise", label: "API access" },
  embeddedInterviews:   { plan: "enterprise", label: "Embedded interviews" },
  customDomain:         { plan: "enterprise", label: "Custom domain" },
};

/**
 * Builds the standard 402 body for a blocked feature.
 * Call this inline inside route handlers when middleware isn't practical.
 */
export function planFeatureError(feature: PlanFeatureName): {
  error: string;
  upgrade_required: true;
  feature: PlanFeatureName;
  required_plan: "pro" | "enterprise";
} {
  const { plan, label } = FEATURE_META[feature];
  return {
    error: `${label} requires the ${plan === "pro" ? "Pro" : "Enterprise"} plan or higher. Upgrade your plan to continue.`,
    upgrade_required: true,
    feature,
    required_plan: plan,
  };
}

/**
 * Middleware that blocks access to a route unless the account's plan includes
 * the given feature.
 *
 * Internal portal users (req.internalEmail) always bypass this check.
 * Returns 402 with upgrade_required: true when the feature is not available.
 */
export function requirePlanFeature(feature: PlanFeatureName) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (req.internalEmail) {
      next();
      return;
    }

    const accountId = req.internalAccountId;
    if (!accountId) {
      res.status(401).json({ error: "Account not resolved." });
      return;
    }

    try {
      const { rows } = await getDb().query<{ plan_tier: string }>(
        `SELECT plan_tier FROM accounts WHERE id = $1`,
        [accountId],
      );
      const planTier = rows[0]?.plan_tier ?? "starter";
      const features = getPlanFeatures(planTier);

      if (!features[feature]) {
        res.status(402).json(planFeatureError(feature));
        return;
      }

      next();
    } catch (err) {
      logger.error({ err, accountId, feature }, "[PlanFeature] Error checking plan feature — failing closed");
      res.status(503).json({ error: "Unable to verify plan features. Please try again in a moment.", retryable: true });
    }
  };
}
