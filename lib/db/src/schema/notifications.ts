import {
  pgTable, serial, bigserial, text, integer, boolean, timestamp, jsonb, date,
  uniqueIndex, index,
} from "drizzle-orm/pg-core";
import { accounts } from "./accounts";

export const userNotificationPrefs = pgTable("user_notification_prefs", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  clerkUserId: text("clerk_user_id").notNull(),
  eventKey: text("event_key").notNull(),
  emailEnabled: boolean("email_enabled").notNull().default(true),
  inAppEnabled: boolean("in_app_enabled").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("user_notification_prefs_unique_idx").on(t.accountId, t.clerkUserId, t.eventKey),
  index("user_notification_prefs_user_idx").on(t.clerkUserId, t.accountId),
]);

export const userInAppNotifications = pgTable("user_in_app_notifications", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  accountId: integer("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  clerkUserId: text("clerk_user_id").notNull(),
  eventKey: text("event_key").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("user_in_app_notif_user_idx").on(t.clerkUserId, t.accountId),
]);

export const planLimitAlerts = pgTable("plan_limit_alerts", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  accountId: integer("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  billingPeriodStart: date("billing_period_start").notNull(),
  thresholdPct: integer("threshold_pct").notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("plan_limit_alerts_unique_idx").on(t.accountId, t.billingPeriodStart, t.thresholdPct),
  index("plan_limit_alerts_lookup_idx").on(t.accountId, t.billingPeriodStart),
]);

export const orgAuditLog = pgTable("org_audit_log", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  accountId: integer("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  actorEmail: text("actor_email"),
  actorUserId: text("actor_user_id"),
  action: text("action").notNull(),
  resourceType: text("resource_type"),
  resourceId: text("resource_id"),
  resourceLabel: text("resource_label"),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  ipAddress: text("ip_address"),
}, (t) => [
  index("org_audit_log_account_created_idx").on(t.accountId, t.createdAt),
]);
