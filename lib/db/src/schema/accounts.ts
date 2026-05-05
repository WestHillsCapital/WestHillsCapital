import {
  pgTable, serial, text, integer, boolean, timestamp, jsonb, date,
  uniqueIndex, index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const accounts = pgTable("accounts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  logoUrl: text("logo_url"),
  formLogoUrl: text("form_logo_url"),
  brandColor: text("brand_color").notNull().default("#C49A38"),
  logoOnWhite: boolean("logo_on_white").notNull().default(true),
  seatLimit: integer("seat_limit").notNull().default(10),
  planTier: text("plan_tier").notNull().default("free"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  subscriptionStatus: text("subscription_status"),
  billingPeriodStart: timestamp("billing_period_start", { withTimezone: true }),
  industry: text("industry"),
  customDomain: text("custom_domain"),
  customDomainStatus: text("custom_domain_status").notNull().default("unverified"),
  customDomainVerifiedAt: timestamp("custom_domain_verified_at", { withTimezone: true }),
  onboardingCompletedSteps: jsonb("onboarding_completed_steps").notNull().default(sql`'{}'::jsonb`),
  allowedIpRanges: text("allowed_ip_ranges").array().notNull().default(sql`'{}'::text[]`),
  slackWebhookUrl: text("slack_webhook_url"),
  slackChannelName: text("slack_channel_name"),
  slackConnectedAt: timestamp("slack_connected_at", { withTimezone: true }),
  slackOauthState: text("slack_oauth_state"),
  gdriveAccessToken: text("gdrive_access_token"),
  gdriveRefreshToken: text("gdrive_refresh_token"),
  gdriveConnectedEmail: text("gdrive_connected_email"),
  gdriveFolderId: text("gdrive_folder_id"),
  gdriveFolderName: text("gdrive_folder_name"),
  gdriveConnectedAt: timestamp("gdrive_connected_at", { withTimezone: true }),
  gdriveOauthState: text("gdrive_oauth_state"),
  hubspotAccessToken: text("hubspot_access_token"),
  hubspotRefreshToken: text("hubspot_refresh_token"),
  hubspotHubId: text("hubspot_hub_id"),
  hubspotHubDomain: text("hubspot_hub_domain"),
  hubspotConnectedAt: timestamp("hubspot_connected_at", { withTimezone: true }),
  hubspotOauthState: text("hubspot_oauth_state"),
  emailSenderName: text("email_sender_name"),
  emailReplyTo: text("email_reply_to"),
  emailFooter: text("email_footer"),
  interviewLinkExpiryDays: integer("interview_link_expiry_days").default(90),
  interviewReminderEnabled: boolean("interview_reminder_enabled").notNull().default(false),
  interviewReminderDays: integer("interview_reminder_days").notNull().default(2),
  interviewDefaultLocale: text("interview_default_locale").notNull().default("en"),
  timezone: text("timezone").notNull().default("America/New_York"),
  dateFormat: text("date_format").notNull().default("MM/DD/YYYY"),
  submissionRetentionDays: integer("submission_retention_days"),
  deletionRequestedAt: timestamp("deletion_requested_at", { withTimezone: true }),
  deletionRequestedBy: text("deletion_requested_by"),
  encryptedDek: text("encrypted_dek"),
  pkgDefaultInterview: boolean("pkg_default_interview").notNull().default(true),
  pkgDefaultCsv: boolean("pkg_default_csv").notNull().default(true),
  pkgDefaultCustomerLink: boolean("pkg_default_customer_link").notNull().default(true),
  pkgDefaultNotifyStaff: boolean("pkg_default_notify_staff").notNull().default(true),
  pkgDefaultNotifyClient: boolean("pkg_default_notify_client").notNull().default(false),
  pkgDefaultEsign: boolean("pkg_default_esign").notNull().default(false),
});

export const accountUsers = pgTable("account_users", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: text("role").notNull().default("member"),
  clerkUserId: text("clerk_user_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  status: text("status").notNull().default("active"),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  invitedBy: text("invited_by"),
  invitedAt: timestamp("invited_at", { withTimezone: true }),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  avatarToken: text("avatar_token"),
  pendingEmail: text("pending_email"),
  pendingEmailToken: text("pending_email_token"),
  pendingEmailExpiresAt: timestamp("pending_email_expires_at", { withTimezone: true }),
  totpSecret: text("totp_secret"),
  totpEnabled: boolean("totp_enabled").notNull().default(false),
  totpBackupCodes: text("totp_backup_codes").array().notNull().default(sql`'{}'::text[]`),
}, (t) => [
  uniqueIndex("account_users_account_email_idx").on(t.accountId, t.email),
  uniqueIndex("account_users_clerk_user_id_idx")
    .on(t.clerkUserId)
    .where(sql`clerk_user_id IS NOT NULL`),
  index("account_users_email_idx").on(sql`lower(email)`),
  uniqueIndex("account_users_avatar_token_idx")
    .on(t.avatarToken)
    .where(sql`avatar_token IS NOT NULL`),
  uniqueIndex("account_users_pending_email_token_idx")
    .on(t.pendingEmailToken)
    .where(sql`pending_email_token IS NOT NULL`),
]);

export const usageEvents = pgTable("usage_events", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),
  periodStart: date("period_start").notNull().default(sql`DATE_TRUNC('month', NOW())`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("usage_events_account_period_idx").on(t.accountId, t.periodStart, t.eventType),
]);

export const internalSessions = pgTable("internal_sessions", {
  token: text("token").primaryKey(),
  email: text("email").notNull(),
  accountId: integer("account_id").notNull().default(1),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("internal_sessions_expires_idx").on(t.expiresAt),
]);

export const accountApiKeys = pgTable("account_api_keys", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  keyHash: text("key_hash").notNull().unique(),
  keyPrefix: text("key_prefix").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
}, (t) => [
  index("account_api_keys_account_idx").on(t.accountId),
  index("account_api_keys_hash_idx").on(t.keyHash),
]);

export const accountAdminNotes = pgTable("account_admin_notes", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  note: text("note").notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("account_admin_notes_account_idx").on(t.accountId),
]);
