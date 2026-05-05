import {
  pgTable, serial, text, integer, boolean, timestamp, jsonb,
  primaryKey, customType,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { accounts } from "./accounts";
import { deals } from "./west-hills";

const bytea = customType<{ data: Buffer; notNull: false; default: false }>({
  dataType() { return "bytea"; },
});

export const docufillMigrationState = pgTable("docufill_migration_state", {
  key: text("key").primaryKey(),
  appliedAt: timestamp("applied_at", { withTimezone: true }).notNull().defaultNow(),
});

export const docufillCustodians = pgTable("docufill_custodians", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  contactName: text("contact_name"),
  email: text("email"),
  phone: text("phone"),
  notes: text("notes"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  accountId: integer("account_id").notNull().references(() => accounts.id),
});

export const docufillDepositories = pgTable("docufill_depositories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  contactName: text("contact_name"),
  email: text("email"),
  phone: text("phone"),
  notes: text("notes"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  accountId: integer("account_id").notNull().references(() => accounts.id),
});

export const docufillTransactionTypes = pgTable("docufill_transaction_types", {
  scope: text("scope").primaryKey(),
  label: text("label").notNull(),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  accountId: integer("account_id").references(() => accounts.id, { onDelete: "cascade" }),
});

export const docufillFields = pgTable("docufill_fields", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  category: text("category").notNull().default("General"),
  fieldType: text("field_type").notNull().default("text"),
  source: text("source").notNull().default("interview"),
  options: jsonb("options").notNull().default(sql`'[]'::jsonb`),
  sensitive: boolean("sensitive").notNull().default(false),
  required: boolean("required").notNull().default(false),
  validationType: text("validation_type").notNull().default("none"),
  validationPattern: text("validation_pattern"),
  validationMessage: text("validation_message"),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(100),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  accountId: integer("account_id").references(() => accounts.id),
});

export const docufillGroups = pgTable("docufill_groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  kind: text("kind").notNull().default("general"),
  phone: text("phone"),
  email: text("email"),
  notes: text("notes"),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(100),
  accountId: integer("account_id").references(() => accounts.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const docufillPackages = pgTable("docufill_packages", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  custodianId: integer("custodian_id").references(() => docufillCustodians.id, { onDelete: "set null" }),
  depositoryId: integer("depository_id").references(() => docufillDepositories.id, { onDelete: "set null" }),
  transactionScope: text("transaction_scope").notNull().default(""),
  description: text("description"),
  status: text("status").notNull().default("draft"),
  version: integer("version").notNull().default(1),
  documents: jsonb("documents").notNull().default(sql`'[]'::jsonb`),
  fields: jsonb("fields").notNull().default(sql`'[]'::jsonb`),
  mappings: jsonb("mappings").notNull().default(sql`'[]'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  recipients: jsonb("recipients").notNull().default(sql`'[]'::jsonb`),
  enableInterview: boolean("enable_interview").notNull().default(true),
  enableCsv: boolean("enable_csv").notNull().default(true),
  enableCustomerLink: boolean("enable_customer_link").notNull().default(false),
  tags: jsonb("tags").notNull().default(sql`'[]'::jsonb`),
  webhookEnabled: boolean("webhook_enabled").notNull().default(false),
  webhookUrl: text("webhook_url"),
  slackNotificationsEnabled: boolean("slack_notifications_enabled").notNull().default(false),
  accountId: integer("account_id").notNull().references(() => accounts.id),
  notifyStaffOnSubmit: boolean("notify_staff_on_submit").notNull().default(false),
  notifyClientOnSubmit: boolean("notify_client_on_submit").notNull().default(false),
  enableEmbed: boolean("enable_embed").notNull().default(false),
  embedKey: text("embed_key"),
  webhookSecret: text("webhook_secret").notNull(),
  groupId: integer("group_id").references(() => docufillGroups.id, { onDelete: "set null" }),
  enableGdrive: boolean("enable_gdrive").notNull().default(false),
  enableHubspot: boolean("enable_hubspot").notNull().default(false),
  authLevel: text("auth_level").notNull().default("none"),
});

export const docufillPackageDocuments = pgTable("docufill_package_documents", {
  id: serial("id").primaryKey(),
  packageId: integer("package_id").notNull().references(() => docufillPackages.id, { onDelete: "cascade" }),
  documentId: text("document_id").notNull(),
  filename: text("filename").notNull(),
  contentType: text("content_type").notNull().default("application/pdf"),
  byteSize: integer("byte_size").notNull(),
  pageCount: integer("page_count").notNull().default(1),
  pdfData: bytea("pdf_data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  pageSizes: jsonb("page_sizes").notNull().default(sql`'[]'::jsonb`),
});

export const docufillPackageGroups = pgTable("docufill_package_groups", {
  packageId: integer("package_id").notNull().references(() => docufillPackages.id, { onDelete: "cascade" }),
  groupId: integer("group_id").notNull().references(() => docufillGroups.id, { onDelete: "cascade" }),
}, (t) => [primaryKey({ columns: [t.packageId, t.groupId] })]);

export const docufillInterviewSessions = pgTable("docufill_interview_sessions", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  packageId: integer("package_id").notNull().references(() => docufillPackages.id, { onDelete: "cascade" }),
  packageVersion: integer("package_version").notNull(),
  dealId: integer("deal_id").references(() => deals.id, { onDelete: "set null" }),
  source: text("source").notNull().default("deal_builder"),
  status: text("status").notNull().default("draft"),
  prefill: jsonb("prefill").notNull().default({}),
  answers: jsonb("answers").notNull().default({}),
  generatedPacket: jsonb("generated_packet"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull().default(sql`(NOW() + INTERVAL '90 days')`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  transactionScope: text("transaction_scope").notNull().default(""),
  generatedPdfDriveId: text("generated_pdf_drive_id"),
  generatedPdfUrl: text("generated_pdf_url"),
  generatedPdfSavedAt: timestamp("generated_pdf_saved_at", { withTimezone: true }),
  testMode: boolean("test_mode").notNull().default(false),
  voidedAt: timestamp("voided_at", { withTimezone: true }),
  voidedReason: text("voided_reason"),
  accountId: integer("account_id").notNull().references(() => accounts.id),
  linkEmailedAt: timestamp("link_emailed_at", { withTimezone: true }),
  linkEmailRecipient: text("link_email_recipient"),
  locale: text("locale").notNull().default("en"),
  reminderEnabled: boolean("reminder_enabled").notNull().default(false),
  reminderDays: integer("reminder_days").notNull().default(2),
  answersCiphertext: text("answers_ciphertext"),
  signerEmail: text("signer_email"),
  signerName: text("signer_name"),
  signedAt: timestamp("signed_at", { withTimezone: true }),
  pdfSha256: text("pdf_sha256"),
  tsaTokenB64: text("tsa_token_b64"),
  tsaUrl: text("tsa_url"),
  generatedPdfStorageKey: text("generated_pdf_storage_key"),
  signerIp: text("signer_ip"),
  signerUa: text("signer_ua"),
  signerGeo: text("signer_geo"),
  batchRunId: text("batch_run_id"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
});

export const webhookDeliveries = pgTable("webhook_deliveries", {
  id: serial("id").primaryKey(),
  packageId: integer("package_id").notNull().references(() => docufillPackages.id, { onDelete: "cascade" }),
  accountId: integer("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull().default("interview.submitted"),
  payloadHash: text("payload_hash").notNull(),
  attemptNumber: integer("attempt_number").notNull().default(1),
  httpStatus: integer("http_status"),
  responseBody: text("response_body"),
  durationMs: integer("duration_ms"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  payloadJson: text("payload_json"),
});

export const docufillEsignOtps = pgTable("docufill_esign_otps", {
  id: serial("id").primaryKey(),
  sessionToken: text("session_token").notNull(),
  email: text("email").notNull(),
  otpHash: text("otp_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  attemptCount: integer("attempt_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const docufillSigningEvents = pgTable("docufill_signing_events", {
  id: serial("id").primaryKey(),
  sessionToken: text("session_token").notNull(),
  accountId: integer("account_id"),
  eventType: text("event_type").notNull(),
  actorEmail: text("actor_email"),
  actorIp: text("actor_ip"),
  actorUa: text("actor_ua"),
  metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
