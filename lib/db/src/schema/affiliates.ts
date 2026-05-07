import {
  pgTable, serial, text, integer, timestamp, numeric, index, unique,
} from "drizzle-orm/pg-core";

export const affiliates = pgTable("affiliates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  company: text("company"),
  website: text("website"),
  referralCode: text("referral_code").notNull().unique(),
  status: text("status").notNull().default("pending"),
  stripeAccountId: text("stripe_account_id"),
  stripeAccountStatus: text("stripe_account_status"),
  commissionRate: numeric("commission_rate", { precision: 5, scale: 4 }).notNull().default("0.2000"),
  commissionMonths: integer("commission_months").notNull().default(12),
  invitedByUserId: text("invited_by_user_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("affiliates_status_idx").on(t.status),
]);

export const affiliateReferrals = pgTable("affiliate_referrals", {
  id: serial("id").primaryKey(),
  affiliateId: integer("affiliate_id").notNull().references(() => affiliates.id),
  stripeCustomerId: text("stripe_customer_id").notNull(),
  stripeSubscriptionId: text("stripe_subscription_id"),
  planType: text("plan_type").notNull(),
  monthlyAmountCents: integer("monthly_amount_cents").notNull(),
  commissionMonthsTotal: integer("commission_months_total").notNull().default(12),
  commissionMonthsPaid: integer("commission_months_paid").notNull().default(0),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("affiliate_referrals_affiliate_idx").on(t.affiliateId),
  index("affiliate_referrals_customer_idx").on(t.stripeCustomerId),
  index("affiliate_referrals_subscription_idx").on(t.stripeSubscriptionId),
  unique("affiliate_referrals_subscription_unique").on(t.stripeSubscriptionId),
]);

export const affiliateCommissions = pgTable("affiliate_commissions", {
  id: serial("id").primaryKey(),
  affiliateId: integer("affiliate_id").notNull().references(() => affiliates.id),
  referralId: integer("referral_id").notNull().references(() => affiliateReferrals.id),
  amountCents: integer("amount_cents").notNull(),
  status: text("status").notNull().default("pending"),
  dueDate: timestamp("due_date", { withTimezone: true }),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  stripeTransferId: text("stripe_transfer_id"),
  periodLabel: text("period_label"),
  stripeInvoiceId: text("stripe_invoice_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("affiliate_commissions_affiliate_idx").on(t.affiliateId),
  index("affiliate_commissions_referral_idx").on(t.referralId),
  index("affiliate_commissions_status_idx").on(t.status),
  unique("affiliate_commissions_invoice_unique").on(t.stripeInvoiceId),
]);
