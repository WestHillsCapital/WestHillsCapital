CREATE TABLE "affiliates" (
        "id" serial PRIMARY KEY NOT NULL,
        "name" text NOT NULL,
        "email" text NOT NULL,
        "company" text,
        "website" text,
        "referral_code" text NOT NULL,
        "status" text DEFAULT 'pending' NOT NULL,
        "stripe_account_id" text,
        "stripe_account_status" text,
        "commission_rate" numeric(5, 4) DEFAULT '0.2000' NOT NULL,
        "commission_months" integer DEFAULT 12 NOT NULL,
        "invited_by_user_id" text,
        "notes" text,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "affiliates_email_unique" UNIQUE("email"),
        CONSTRAINT "affiliates_referral_code_unique" UNIQUE("referral_code")
);
--> statement-breakpoint
CREATE TABLE "affiliate_referrals" (
        "id" serial PRIMARY KEY NOT NULL,
        "affiliate_id" integer NOT NULL,
        "stripe_customer_id" text NOT NULL,
        "stripe_subscription_id" text,
        "plan_type" text NOT NULL,
        "monthly_amount_cents" integer NOT NULL,
        "commission_months_total" integer DEFAULT 12 NOT NULL,
        "commission_months_paid" integer DEFAULT 0 NOT NULL,
        "status" text DEFAULT 'active' NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "affiliate_referrals_subscription_unique" UNIQUE("stripe_subscription_id")
);
--> statement-breakpoint
CREATE TABLE "affiliate_commissions" (
        "id" serial PRIMARY KEY NOT NULL,
        "affiliate_id" integer NOT NULL,
        "referral_id" integer NOT NULL,
        "amount_cents" integer NOT NULL,
        "status" text DEFAULT 'pending' NOT NULL,
        "due_date" timestamp with time zone,
        "paid_at" timestamp with time zone,
        "stripe_transfer_id" text,
        "period_label" text,
        "stripe_invoice_id" text,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "affiliate_commissions_invoice_unique" UNIQUE("stripe_invoice_id")
);
--> statement-breakpoint
ALTER TABLE "affiliate_referrals" ADD CONSTRAINT "affiliate_referrals_affiliate_id_affiliates_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."affiliates"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "affiliate_commissions" ADD CONSTRAINT "affiliate_commissions_affiliate_id_affiliates_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."affiliates"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "affiliate_commissions" ADD CONSTRAINT "affiliate_commissions_referral_id_affiliate_referrals_id_fk" FOREIGN KEY ("referral_id") REFERENCES "public"."affiliate_referrals"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "affiliates_status_idx" ON "affiliates" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "affiliate_referrals_affiliate_idx" ON "affiliate_referrals" USING btree ("affiliate_id");
--> statement-breakpoint
CREATE INDEX "affiliate_referrals_customer_idx" ON "affiliate_referrals" USING btree ("stripe_customer_id");
--> statement-breakpoint
CREATE INDEX "affiliate_referrals_subscription_idx" ON "affiliate_referrals" USING btree ("stripe_subscription_id");
--> statement-breakpoint
CREATE INDEX "affiliate_commissions_affiliate_idx" ON "affiliate_commissions" USING btree ("affiliate_id");
--> statement-breakpoint
CREATE INDEX "affiliate_commissions_referral_idx" ON "affiliate_commissions" USING btree ("referral_id");
--> statement-breakpoint
CREATE INDEX "affiliate_commissions_status_idx" ON "affiliate_commissions" USING btree ("status");
