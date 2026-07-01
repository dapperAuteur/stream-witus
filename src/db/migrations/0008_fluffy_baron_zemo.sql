ALTER TABLE "podcast_episodes" ADD COLUMN "audio_length_bytes" integer;--> statement-breakpoint
ALTER TABLE "podcast_episodes" ADD COLUMN "audio_mime" text;--> statement-breakpoint
ALTER TABLE "podcast_shows" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "podcast_shows" ADD COLUMN "author" text;--> statement-breakpoint
ALTER TABLE "podcast_shows" ADD COLUMN "owner_email" text;--> statement-breakpoint
ALTER TABLE "podcast_shows" ADD COLUMN "category" text;--> statement-breakpoint
ALTER TABLE "podcast_shows" ADD COLUMN "language" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "podcast_shows" ADD COLUMN "explicit" boolean DEFAULT false NOT NULL;