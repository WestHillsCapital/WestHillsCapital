import {
  pgTable, serial, text, integer, boolean, timestamp,
} from "drizzle-orm/pg-core";
import { accounts, accountUsers } from "./accounts";

export const userActiveSessions = pgTable("user_active_sessions", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => accountUsers.id, { onDelete: "cascade" }),
  clerkSessionId: text("clerk_session_id").notNull().unique(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  lastActiveAt: timestamp("last_active_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  totpVerified: boolean("totp_verified").notNull().default(false),
});

export const userLoginHistory = pgTable("user_login_history", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => accountUsers.id, { onDelete: "cascade" }),
  clerkSessionId: text("clerk_session_id"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const trustedDevices = pgTable("trusted_devices", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => accountUsers.id, { onDelete: "cascade" }),
  accountId: integer("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  label: text("label").notNull().default(""),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
});
