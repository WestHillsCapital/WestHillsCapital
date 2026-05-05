CREATE TABLE "account_admin_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL,
	"note" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account_api_keys" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL,
	"name" text NOT NULL,
	"key_hash" text NOT NULL,
	"key_prefix" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	CONSTRAINT "account_api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "account_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"clerk_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"last_seen_at" timestamp with time zone,
	"invited_by" text,
	"invited_at" timestamp with time zone,
	"display_name" text,
	"avatar_url" text,
	"avatar_token" text,
	"pending_email" text,
	"pending_email_token" text,
	"pending_email_expires_at" timestamp with time zone,
	"totp_secret" text,
	"totp_enabled" boolean DEFAULT false NOT NULL,
	"totp_backup_codes" text[] DEFAULT '{}'::text[] NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"logo_url" text,
	"form_logo_url" text,
	"brand_color" text DEFAULT '#C49A38' NOT NULL,
	"logo_on_white" boolean DEFAULT true NOT NULL,
	"seat_limit" integer DEFAULT 10 NOT NULL,
	"plan_tier" text DEFAULT 'free' NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"subscription_status" text,
	"billing_period_start" timestamp with time zone,
	"industry" text,
	"custom_domain" text,
	"custom_domain_status" text DEFAULT 'unverified' NOT NULL,
	"custom_domain_verified_at" timestamp with time zone,
	"onboarding_completed_steps" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"allowed_ip_ranges" text[] DEFAULT '{}'::text[] NOT NULL,
	"slack_webhook_url" text,
	"slack_channel_name" text,
	"slack_connected_at" timestamp with time zone,
	"slack_oauth_state" text,
	"gdrive_access_token" text,
	"gdrive_refresh_token" text,
	"gdrive_connected_email" text,
	"gdrive_folder_id" text,
	"gdrive_folder_name" text,
	"gdrive_connected_at" timestamp with time zone,
	"gdrive_oauth_state" text,
	"hubspot_access_token" text,
	"hubspot_refresh_token" text,
	"hubspot_hub_id" text,
	"hubspot_hub_domain" text,
	"hubspot_connected_at" timestamp with time zone,
	"hubspot_oauth_state" text,
	"email_sender_name" text,
	"email_reply_to" text,
	"email_footer" text,
	"interview_link_expiry_days" integer DEFAULT 90,
	"interview_reminder_enabled" boolean DEFAULT false NOT NULL,
	"interview_reminder_days" integer DEFAULT 2 NOT NULL,
	"interview_default_locale" text DEFAULT 'en' NOT NULL,
	"timezone" text DEFAULT 'America/New_York' NOT NULL,
	"date_format" text DEFAULT 'MM/DD/YYYY' NOT NULL,
	"submission_retention_days" integer,
	"deletion_requested_at" timestamp with time zone,
	"deletion_requested_by" text,
	"encrypted_dek" text,
	"pkg_default_interview" boolean DEFAULT true NOT NULL,
	"pkg_default_csv" boolean DEFAULT true NOT NULL,
	"pkg_default_customer_link" boolean DEFAULT true NOT NULL,
	"pkg_default_notify_staff" boolean DEFAULT true NOT NULL,
	"pkg_default_notify_client" boolean DEFAULT false NOT NULL,
	"pkg_default_esign" boolean DEFAULT false NOT NULL,
	CONSTRAINT "accounts_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "internal_sessions" (
	"token" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"account_id" integer DEFAULT 1 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL,
	"event_type" text NOT NULL,
	"period_start" date DEFAULT DATE_TRUNC('month', NOW()) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" serial PRIMARY KEY NOT NULL,
	"confirmation_id" text NOT NULL,
	"slot_id" text NOT NULL,
	"scheduled_time" timestamp with time zone NOT NULL,
	"day_label" text NOT NULL,
	"time_label" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"state" text NOT NULL,
	"allocation_type" text NOT NULL,
	"allocation_range" text NOT NULL,
	"timeline" text NOT NULL,
	"status" text DEFAULT 'confirmed' NOT NULL,
	"calendar_event_id" text,
	"lead_id" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "appointments_confirmation_id_unique" UNIQUE("confirmation_id")
);
--> statement-breakpoint
CREATE TABLE "booking_attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"email" text NOT NULL,
	"slot_id" text NOT NULL,
	"ip_address" text,
	"success" boolean NOT NULL,
	"confirmation_id" text,
	"error_code" text,
	"error_detail" text
);
--> statement-breakpoint
CREATE TABLE "content_articles" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"excerpt" text NOT NULL,
	"group_id" text DEFAULT 'making-smart-decisions' NOT NULL,
	"meta_description" text DEFAULT '' NOT NULL,
	"sections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"related" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_articles_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "deals" (
	"id" serial PRIMARY KEY NOT NULL,
	"lead_id" integer,
	"confirmation_id" text,
	"deal_type" text DEFAULT 'cash' NOT NULL,
	"ira_type" text,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"state" text,
	"custodian" text,
	"custodian_id" integer,
	"depository" text,
	"depository_id" integer,
	"ira_account_number" text,
	"gold_spot_ask" numeric(12, 4),
	"silver_spot_ask" numeric(12, 4),
	"spot_timestamp" timestamp with time zone,
	"products" jsonb,
	"subtotal" numeric(12, 2),
	"shipping" numeric(12, 2),
	"total" numeric(12, 2),
	"balance_due" numeric(12, 2),
	"shipping_method" text DEFAULT 'fedex_hold',
	"fedex_location" text,
	"notes" text,
	"status" text DEFAULT 'locked' NOT NULL,
	"locked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ship_to_name" text,
	"ship_to_line1" text,
	"ship_to_city" text,
	"ship_to_state" text,
	"ship_to_zip" text,
	"external_trade_id" text,
	"supplier_confirmation_id" text,
	"execution_status" text,
	"execution_timestamp" timestamp with time zone,
	"invoice_id" text,
	"invoice_url" text,
	"invoice_generated_at" timestamp with time zone,
	"recap_email_sent_at" timestamp with time zone,
	"billing_line1" text,
	"billing_line2" text,
	"billing_city" text,
	"billing_state" text,
	"billing_zip" text,
	"fedex_location_hours" text,
	"terms_provided" boolean,
	"terms_provided_at" timestamp with time zone,
	"terms_version" text,
	"confirmation_method" text,
	"payment_received_at" timestamp with time zone,
	"tracking_number" text,
	"order_placed_at" timestamp with time zone,
	"execution_warnings" jsonb DEFAULT '[]'::jsonb,
	"wire_received_at" timestamp with time zone,
	"order_paid_at" timestamp with time zone,
	"shipped_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"shipping_notification_scheduled_at" timestamp with time zone,
	"shipping_email_sent_at" timestamp with time zone,
	"delivery_email_sent_at" timestamp with time zone,
	"follow_up_7d_scheduled_at" timestamp with time zone,
	"follow_up_30d_scheduled_at" timestamp with time zone,
	"follow_up_7d_sent_at" timestamp with time zone,
	"follow_up_30d_sent_at" timestamp with time zone,
	"wire_confirmation_email_sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" serial PRIMARY KEY NOT NULL,
	"form_type" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"state" text,
	"allocation_type" text,
	"allocation_range" text,
	"timeline" text,
	"current_custodian" text,
	"ip_address" text,
	"status" text DEFAULT 'new' NOT NULL,
	"notes" text,
	"follow_up_date" date,
	"owner" text,
	"linked_confirmation_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "spot_price_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"gold_bid" numeric(12, 4),
	"gold_ask" numeric(12, 4),
	"silver_bid" numeric(12, 4),
	"silver_ask" numeric(12, 4),
	"source" text,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "docufill_custodians" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"contact_name" text,
	"email" text,
	"phone" text,
	"notes" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"account_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "docufill_depositories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"contact_name" text,
	"email" text,
	"phone" text,
	"notes" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"account_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "docufill_esign_otps" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_token" text NOT NULL,
	"email" text NOT NULL,
	"otp_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "docufill_fields" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"category" text DEFAULT 'General' NOT NULL,
	"field_type" text DEFAULT 'text' NOT NULL,
	"source" text DEFAULT 'interview' NOT NULL,
	"options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sensitive" boolean DEFAULT false NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"validation_type" text DEFAULT 'none' NOT NULL,
	"validation_pattern" text,
	"validation_message" text,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 100 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"account_id" integer
);
--> statement-breakpoint
CREATE TABLE "docufill_groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'general' NOT NULL,
	"phone" text,
	"email" text,
	"notes" text,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 100 NOT NULL,
	"account_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "docufill_interview_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"package_id" integer NOT NULL,
	"package_version" integer NOT NULL,
	"deal_id" integer,
	"source" text DEFAULT 'deal_builder' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"prefill" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"generated_packet" jsonb,
	"expires_at" timestamp with time zone DEFAULT (NOW() + INTERVAL '90 days') NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"transaction_scope" text DEFAULT '' NOT NULL,
	"generated_pdf_drive_id" text,
	"generated_pdf_url" text,
	"generated_pdf_saved_at" timestamp with time zone,
	"test_mode" boolean DEFAULT false NOT NULL,
	"voided_at" timestamp with time zone,
	"voided_reason" text,
	"account_id" integer NOT NULL,
	"link_emailed_at" timestamp with time zone,
	"link_email_recipient" text,
	"locale" text DEFAULT 'en' NOT NULL,
	"reminder_enabled" boolean DEFAULT false NOT NULL,
	"reminder_days" integer DEFAULT 2 NOT NULL,
	"answers_ciphertext" text,
	"signer_email" text,
	"signer_name" text,
	"signed_at" timestamp with time zone,
	"pdf_sha256" text,
	"tsa_token_b64" text,
	"tsa_url" text,
	"generated_pdf_storage_key" text,
	"signer_ip" text,
	"signer_ua" text,
	"signer_geo" text,
	"batch_run_id" text,
	"submitted_at" timestamp with time zone,
	CONSTRAINT "docufill_interview_sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "docufill_migration_state" (
	"key" text PRIMARY KEY NOT NULL,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "docufill_package_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"package_id" integer NOT NULL,
	"document_id" text NOT NULL,
	"filename" text NOT NULL,
	"content_type" text DEFAULT 'application/pdf' NOT NULL,
	"byte_size" integer NOT NULL,
	"page_count" integer DEFAULT 1 NOT NULL,
	"pdf_data" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"page_sizes" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "docufill_package_groups" (
	"package_id" integer NOT NULL,
	"group_id" integer NOT NULL,
	CONSTRAINT "docufill_package_groups_package_id_group_id_pk" PRIMARY KEY("package_id","group_id")
);
--> statement-breakpoint
CREATE TABLE "docufill_packages" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"custodian_id" integer,
	"depository_id" integer,
	"transaction_scope" text DEFAULT '' NOT NULL,
	"description" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"documents" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"mappings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"recipients" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"enable_interview" boolean DEFAULT true NOT NULL,
	"enable_csv" boolean DEFAULT true NOT NULL,
	"enable_customer_link" boolean DEFAULT false NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"webhook_enabled" boolean DEFAULT false NOT NULL,
	"webhook_url" text,
	"slack_notifications_enabled" boolean DEFAULT false NOT NULL,
	"account_id" integer NOT NULL,
	"notify_staff_on_submit" boolean DEFAULT false NOT NULL,
	"notify_client_on_submit" boolean DEFAULT false NOT NULL,
	"enable_embed" boolean DEFAULT false NOT NULL,
	"embed_key" text,
	"webhook_secret" text NOT NULL,
	"group_id" integer,
	"enable_gdrive" boolean DEFAULT false NOT NULL,
	"enable_hubspot" boolean DEFAULT false NOT NULL,
	"auth_level" text DEFAULT 'none' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "docufill_signing_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_token" text NOT NULL,
	"account_id" integer,
	"event_type" text NOT NULL,
	"actor_email" text,
	"actor_ip" text,
	"actor_ua" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "docufill_transaction_types" (
	"scope" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"account_id" integer
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" serial PRIMARY KEY NOT NULL,
	"package_id" integer NOT NULL,
	"account_id" integer NOT NULL,
	"event_type" text DEFAULT 'interview.submitted' NOT NULL,
	"payload_hash" text NOT NULL,
	"attempt_number" integer DEFAULT 1 NOT NULL,
	"http_status" integer,
	"response_body" text,
	"duration_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"payload_json" text
);
--> statement-breakpoint
CREATE TABLE "org_audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL,
	"actor_email" text,
	"actor_user_id" text,
	"action" text NOT NULL,
	"resource_type" text,
	"resource_id" text,
	"resource_label" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text
);
--> statement-breakpoint
CREATE TABLE "plan_limit_alerts" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL,
	"billing_period_start" date NOT NULL,
	"threshold_pct" integer NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_in_app_notifications" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL,
	"clerk_user_id" text NOT NULL,
	"event_key" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_notification_prefs" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL,
	"clerk_user_id" text NOT NULL,
	"event_key" text NOT NULL,
	"email_enabled" boolean DEFAULT true NOT NULL,
	"in_app_enabled" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trusted_devices" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"account_id" integer NOT NULL,
	"token_hash" text NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"ip_address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_used_at" timestamp with time zone,
	CONSTRAINT "trusted_devices_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "user_active_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"clerk_session_id" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"last_active_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"totp_verified" boolean DEFAULT false NOT NULL,
	CONSTRAINT "user_active_sessions_clerk_session_id_unique" UNIQUE("clerk_session_id")
);
--> statement-breakpoint
CREATE TABLE "user_login_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"clerk_session_id" text,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brand_color_rate_limit" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"window_start" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_export_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL,
	"requested_by" text NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"download_token" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"export_json" text,
	"completed_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"export_format" text DEFAULT 'zip' NOT NULL,
	CONSTRAINT "data_export_requests_download_token_unique" UNIQUE("download_token")
);
--> statement-breakpoint
CREATE TABLE "pack_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL,
	"stripe_subscription_id" text NOT NULL,
	"pack_size" integer NOT NULL,
	"pack_type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pack_subscriptions_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);
--> statement-breakpoint
CREATE TABLE "pdf_audit_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL,
	"session_token" text NOT NULL,
	"event_type" text NOT NULL,
	"actor_type" text NOT NULL,
	"actor_email" text,
	"actor_ip" text,
	"actor_ua" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submission_bank" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL,
	"amount" integer NOT NULL,
	"remaining" integer NOT NULL,
	"source" text NOT NULL,
	"pack_size" integer NOT NULL,
	"stripe_ref" text,
	"deposited_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account_admin_notes" ADD CONSTRAINT "account_admin_notes_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_api_keys" ADD CONSTRAINT "account_api_keys_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_users" ADD CONSTRAINT "account_users_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docufill_custodians" ADD CONSTRAINT "docufill_custodians_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docufill_depositories" ADD CONSTRAINT "docufill_depositories_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docufill_fields" ADD CONSTRAINT "docufill_fields_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docufill_groups" ADD CONSTRAINT "docufill_groups_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docufill_interview_sessions" ADD CONSTRAINT "docufill_interview_sessions_package_id_docufill_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."docufill_packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docufill_interview_sessions" ADD CONSTRAINT "docufill_interview_sessions_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docufill_interview_sessions" ADD CONSTRAINT "docufill_interview_sessions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docufill_package_documents" ADD CONSTRAINT "docufill_package_documents_package_id_docufill_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."docufill_packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docufill_package_groups" ADD CONSTRAINT "docufill_package_groups_package_id_docufill_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."docufill_packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docufill_package_groups" ADD CONSTRAINT "docufill_package_groups_group_id_docufill_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."docufill_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docufill_packages" ADD CONSTRAINT "docufill_packages_custodian_id_docufill_custodians_id_fk" FOREIGN KEY ("custodian_id") REFERENCES "public"."docufill_custodians"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docufill_packages" ADD CONSTRAINT "docufill_packages_depository_id_docufill_depositories_id_fk" FOREIGN KEY ("depository_id") REFERENCES "public"."docufill_depositories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docufill_packages" ADD CONSTRAINT "docufill_packages_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docufill_packages" ADD CONSTRAINT "docufill_packages_group_id_docufill_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."docufill_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docufill_transaction_types" ADD CONSTRAINT "docufill_transaction_types_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_package_id_docufill_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."docufill_packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_audit_log" ADD CONSTRAINT "org_audit_log_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_limit_alerts" ADD CONSTRAINT "plan_limit_alerts_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_in_app_notifications" ADD CONSTRAINT "user_in_app_notifications_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_notification_prefs" ADD CONSTRAINT "user_notification_prefs_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trusted_devices" ADD CONSTRAINT "trusted_devices_user_id_account_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."account_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trusted_devices" ADD CONSTRAINT "trusted_devices_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_active_sessions" ADD CONSTRAINT "user_active_sessions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_active_sessions" ADD CONSTRAINT "user_active_sessions_user_id_account_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."account_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_login_history" ADD CONSTRAINT "user_login_history_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_login_history" ADD CONSTRAINT "user_login_history_user_id_account_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."account_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_export_requests" ADD CONSTRAINT "data_export_requests_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pack_subscriptions" ADD CONSTRAINT "pack_subscriptions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pdf_audit_events" ADD CONSTRAINT "pdf_audit_events_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_bank" ADD CONSTRAINT "submission_bank_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_admin_notes_account_idx" ON "account_admin_notes" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "account_api_keys_account_idx" ON "account_api_keys" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "account_api_keys_hash_idx" ON "account_api_keys" USING btree ("key_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "account_users_account_email_idx" ON "account_users" USING btree ("account_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX "account_users_clerk_user_id_idx" ON "account_users" USING btree ("clerk_user_id") WHERE clerk_user_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "account_users_email_idx" ON "account_users" USING btree (lower(email));--> statement-breakpoint
CREATE UNIQUE INDEX "account_users_avatar_token_idx" ON "account_users" USING btree ("avatar_token") WHERE avatar_token IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "account_users_pending_email_token_idx" ON "account_users" USING btree ("pending_email_token") WHERE pending_email_token IS NOT NULL;--> statement-breakpoint
CREATE INDEX "internal_sessions_expires_idx" ON "internal_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "usage_events_account_period_idx" ON "usage_events" USING btree ("account_id","period_start","event_type");--> statement-breakpoint
CREATE UNIQUE INDEX "appointments_slot_id_confirmed_idx" ON "appointments" USING btree ("slot_id") WHERE status = 'confirmed';--> statement-breakpoint
CREATE UNIQUE INDEX "docufill_custodians_account_name_idx" ON "docufill_custodians" USING btree ("account_id","name");--> statement-breakpoint
CREATE INDEX "docufill_custodians_account_idx" ON "docufill_custodians" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "docufill_depositories_account_name_idx" ON "docufill_depositories" USING btree ("account_id","name");--> statement-breakpoint
CREATE INDEX "docufill_depositories_account_idx" ON "docufill_depositories" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "docufill_esign_otps_session_idx" ON "docufill_esign_otps" USING btree ("session_token");--> statement-breakpoint
CREATE UNIQUE INDEX "docufill_fields_global_label_unique" ON "docufill_fields" USING btree ("label") WHERE account_id IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "docufill_fields_account_label_unique" ON "docufill_fields" USING btree ("account_id","label") WHERE account_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "docufill_interview_sessions_token_idx" ON "docufill_interview_sessions" USING btree ("token");--> statement-breakpoint
CREATE INDEX "docufill_interview_sessions_account_idx" ON "docufill_interview_sessions" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "dis_batch_run_idx" ON "docufill_interview_sessions" USING btree ("batch_run_id") WHERE batch_run_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "docufill_package_documents_unique_idx" ON "docufill_package_documents" USING btree ("package_id","document_id");--> statement-breakpoint
CREATE INDEX "docufill_package_documents_package_idx" ON "docufill_package_documents" USING btree ("package_id");--> statement-breakpoint
CREATE INDEX "docufill_package_groups_package_idx" ON "docufill_package_groups" USING btree ("package_id");--> statement-breakpoint
CREATE INDEX "docufill_packages_account_idx" ON "docufill_packages" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "docufill_packages_combo_idx" ON "docufill_packages" USING btree ("account_id","status");--> statement-breakpoint
CREATE INDEX "docufill_packages_workflow_idx" ON "docufill_packages" USING btree ("account_id","webhook_enabled");--> statement-breakpoint
CREATE INDEX "docufill_signing_events_session_idx" ON "docufill_signing_events" USING btree ("session_token");--> statement-breakpoint
CREATE INDEX "docufill_transaction_types_account_idx" ON "docufill_transaction_types" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_package_created_idx" ON "webhook_deliveries" USING btree ("package_id","created_at");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_account_idx" ON "webhook_deliveries" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "org_audit_log_account_created_idx" ON "org_audit_log" USING btree ("account_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "plan_limit_alerts_unique_idx" ON "plan_limit_alerts" USING btree ("account_id","billing_period_start","threshold_pct");--> statement-breakpoint
CREATE INDEX "plan_limit_alerts_lookup_idx" ON "plan_limit_alerts" USING btree ("account_id","billing_period_start");--> statement-breakpoint
CREATE INDEX "user_in_app_notif_user_idx" ON "user_in_app_notifications" USING btree ("clerk_user_id","account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_notification_prefs_unique_idx" ON "user_notification_prefs" USING btree ("account_id","clerk_user_id","event_key");--> statement-breakpoint
CREATE INDEX "user_notification_prefs_user_idx" ON "user_notification_prefs" USING btree ("clerk_user_id","account_id");--> statement-breakpoint
CREATE INDEX "trusted_devices_user_idx" ON "trusted_devices" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_active_sessions_user_idx" ON "user_active_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_login_history_user_idx" ON "user_login_history" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "data_export_requests_status_idx" ON "data_export_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "pack_subscriptions_stripe_idx" ON "pack_subscriptions" USING btree ("stripe_subscription_id");--> statement-breakpoint
CREATE INDEX "pdf_audit_events_session_idx" ON "pdf_audit_events" USING btree ("session_token");--> statement-breakpoint
CREATE INDEX "pdf_audit_events_account_idx" ON "pdf_audit_events" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "submission_bank_account_expiry_idx" ON "submission_bank" USING btree ("account_id","expires_at");