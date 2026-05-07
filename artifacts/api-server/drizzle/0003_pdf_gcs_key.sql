ALTER TABLE "docufill_package_documents" ADD COLUMN IF NOT EXISTS "pdf_gcs_key" text;--> statement-breakpoint
ALTER TABLE "docufill_package_documents" ALTER COLUMN "pdf_data" DROP NOT NULL;
