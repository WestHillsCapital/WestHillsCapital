ALTER TABLE "accounts" ADD COLUMN "trial_ended_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "data_purged_at" timestamp with time zone;