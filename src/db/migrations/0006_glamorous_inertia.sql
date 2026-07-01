ALTER TABLE "users" ADD COLUMN "admin_role" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "deactivated" boolean DEFAULT false NOT NULL;