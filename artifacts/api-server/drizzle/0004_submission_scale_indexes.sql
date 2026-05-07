CREATE INDEX IF NOT EXISTS "dis_account_created_idx" ON "docufill_interview_sessions" USING btree ("account_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dis_account_package_idx" ON "docufill_interview_sessions" USING btree ("account_id","package_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dis_account_status_idx" ON "docufill_interview_sessions" USING btree ("account_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dis_account_expires_idx" ON "docufill_interview_sessions" USING btree ("account_id","expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "docufill_packages_account_created_idx" ON "docufill_packages" USING btree ("account_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhook_deliveries_account_created_idx" ON "webhook_deliveries" USING btree ("account_id","created_at" DESC NULLS LAST);
