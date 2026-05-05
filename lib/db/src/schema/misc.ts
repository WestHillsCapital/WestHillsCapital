import {
  pgTable, serial, text, integer, boolean, timestamp, jsonb, bigint,
  customType,
} from "drizzle-orm/pg-core";
import { accounts } from "./accounts";

export const dataExportRequests = pgTable("data_export_requests", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  requestedBy: text("requested_by").notNull(),
  requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
  downloadToken: text("download_token").notNull().unique(),
  status: text("status").notNull().default("pending"),
  exportJson: text("export_json"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  exportFormat: text("export_format").notNull().default("zip"),
});

export const brandColorRateLimit = pgTable("brand_color_rate_limit", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  windowStart: bigint("window_start", { mode: "number" }).notNull(),
});

export const submissionBank = pgTable("submission_bank", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(),
  remaining: integer("remaining").notNull(),
  source: text("source").notNull(),
  packSize: integer("pack_size").notNull(),
  stripeRef: text("stripe_ref"),
  depositedAt: timestamp("deposited_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const packSubscriptions = pgTable("pack_subscriptions", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  stripeSubscriptionId: text("stripe_subscription_id").notNull().unique(),
  packSize: integer("pack_size").notNull(),
  packType: text("pack_type").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pdfAuditEvents = pgTable("pdf_audit_events", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  sessionToken: text("session_token").notNull(),
  eventType: text("event_type").notNull(),
  actorType: text("actor_type").notNull(),
  actorEmail: text("actor_email"),
  actorIp: text("actor_ip"),
  actorUa: text("actor_ua"),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
