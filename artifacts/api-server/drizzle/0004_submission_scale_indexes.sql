-- DRIZZLE:RUN-CONCURRENT
-- On existing databases the runDrizzleMigrations() pre-handler executes these
-- statements with CREATE INDEX CONCURRENTLY outside any transaction so that
-- index builds do not block concurrent writes on large tables.
-- On fresh databases migrate() runs them as plain CREATE INDEX IF NOT EXISTS
-- inside its transaction (tables are new and small, so no lock contention).
ALTER TABLE "webhook_deliveries" ADD COLUMN IF NOT EXISTS "session_id" integer REFERENCES "docufill_interview_sessions"("id") ON DELETE SET NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dis_account_created_idx" ON "docufill_interview_sessions" USING btree ("account_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dis_account_package_idx" ON "docufill_interview_sessions" USING btree ("account_id","package_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dis_account_status_idx" ON "docufill_interview_sessions" USING btree ("account_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dis_account_expires_idx" ON "docufill_interview_sessions" USING btree ("account_id","expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "docufill_packages_account_created_idx" ON "docufill_packages" USING btree ("account_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhook_deliveries_account_created_idx" ON "webhook_deliveries" USING btree ("account_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhook_deliveries_session_created_idx" ON "webhook_deliveries" USING btree ("session_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "org_audit_log_account_created_idx" ON "org_audit_log" USING btree ("account_id","created_at" DESC NULLS LAST);
