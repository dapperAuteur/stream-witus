ALTER TABLE "club_discussion" ADD COLUMN "removed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "featured" boolean DEFAULT false NOT NULL;