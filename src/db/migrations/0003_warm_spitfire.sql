CREATE TABLE "podcast_shows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"artwork_url" text,
	"feed_url" text,
	"outbox_slug_env_key" text,
	"outbox_secret_env_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "podcast_shows_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "podcast_episodes" ADD COLUMN "show_id" uuid;--> statement-breakpoint
ALTER TABLE "podcast_episodes" ADD COLUMN "artwork_url" text;--> statement-breakpoint
ALTER TABLE "podcast_episodes" ADD COLUMN "show_notes_excerpt" text;--> statement-breakpoint
ALTER TABLE "podcast_episodes" ADD COLUMN "published_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "podcast_episodes" ADD COLUMN "disctopia_guid" text;--> statement-breakpoint
ALTER TABLE "podcast_episodes" ADD CONSTRAINT "podcast_episodes_show_id_podcast_shows_id_fk" FOREIGN KEY ("show_id") REFERENCES "public"."podcast_shows"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "podcast_episodes" ADD CONSTRAINT "podcast_episodes_disctopia_guid_unique" UNIQUE("disctopia_guid");