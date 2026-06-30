CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"name" text,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"icon" text,
	"color" text DEFAULT '#8b5cf6' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_categories_user_name_uniq" UNIQUE("user_id","name")
);
--> statement-breakpoint
CREATE TABLE "media_creators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"use_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_creators_user_name_uniq" UNIQUE("user_id","name")
);
--> statement-breakpoint
CREATE TABLE "media_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"creator" text,
	"media_type" text NOT NULL,
	"status" text DEFAULT 'want_to_consume' NOT NULL,
	"rating" smallint,
	"start_date" date,
	"end_date" date,
	"genre" text[] DEFAULT '{}'::text[],
	"tags" text[] DEFAULT '{}'::text[],
	"cover_image_url" text,
	"external_url" text,
	"category_id" uuid,
	"current_progress" text,
	"total_length" text,
	"season_number" smallint,
	"episode_number" smallint,
	"total_seasons" smallint,
	"total_episodes" smallint,
	"visibility" text DEFAULT 'private' NOT NULL,
	"year_released" smallint,
	"source_platform" text,
	"notes" text,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"use_count" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"external_source" text,
	"external_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_items_rating_range" CHECK ("media_items"."rating" IS NULL OR ("media_items"."rating" >= 1 AND "media_items"."rating" <= 5))
);
--> statement-breakpoint
CREATE TABLE "media_platforms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"use_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_platforms_user_name_uniq" UNIQUE("user_id","name")
);
--> statement-breakpoint
CREATE TABLE "media_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"media_item_id" uuid NOT NULL,
	"title" text,
	"content" text DEFAULT '' NOT NULL,
	"content_format" text DEFAULT 'markdown' NOT NULL,
	"note_type" text DEFAULT 'general' NOT NULL,
	"audio_url" text,
	"audio_public_id" text,
	"is_public" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_relationships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"parent_id" uuid NOT NULL,
	"child_id" uuid NOT NULL,
	"relationship_type" text NOT NULL,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_relationships_parent_child_type_uniq" UNIQUE("parent_id","child_id","relationship_type"),
	CONSTRAINT "media_relationships_no_self" CHECK ("media_relationships"."parent_id" <> "media_relationships"."child_id")
);
--> statement-breakpoint
CREATE TABLE "media_episode_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"media_item_id" uuid NOT NULL,
	"episode_id" uuid NOT NULL,
	"discussion_notes" text,
	"timestamp_start" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_episode_links_item_episode_uniq" UNIQUE("media_item_id","episode_id")
);
--> statement-breakpoint
CREATE TABLE "podcast_episodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"episode_number" integer,
	"season_number" integer,
	"air_date" date,
	"description" text,
	"show_notes" text,
	"show_notes_format" text DEFAULT 'markdown' NOT NULL,
	"audio_url" text,
	"external_url" text,
	"duration_min" integer,
	"status" text DEFAULT 'draft' NOT NULL,
	"visibility" text DEFAULT 'private' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "club_discussion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_read_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"parent_id" uuid,
	"milestone_id" uuid,
	"is_spoiler" boolean DEFAULT false NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "club_member_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_read_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"current_milestone_id" uuid,
	"progress_note" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "club_member_progress_read_user_uniq" UNIQUE("club_read_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "club_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "club_members_club_user_uniq" UNIQUE("club_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "club_reads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"media_item_id" uuid,
	"title" text,
	"status" text DEFAULT 'upcoming' NOT NULL,
	"start_date" date,
	"target_end_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "club_schedule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_read_id" uuid NOT NULL,
	"label" text NOT NULL,
	"due_date" date,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clubs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"visibility" text DEFAULT 'private' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clubs_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_categories" ADD CONSTRAINT "media_categories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_creators" ADD CONSTRAINT "media_creators_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_items" ADD CONSTRAINT "media_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_items" ADD CONSTRAINT "media_items_category_id_media_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."media_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_platforms" ADD CONSTRAINT "media_platforms_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_notes" ADD CONSTRAINT "media_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_notes" ADD CONSTRAINT "media_notes_media_item_id_media_items_id_fk" FOREIGN KEY ("media_item_id") REFERENCES "public"."media_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_relationships" ADD CONSTRAINT "media_relationships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_relationships" ADD CONSTRAINT "media_relationships_parent_id_media_items_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."media_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_relationships" ADD CONSTRAINT "media_relationships_child_id_media_items_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."media_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_episode_links" ADD CONSTRAINT "media_episode_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_episode_links" ADD CONSTRAINT "media_episode_links_media_item_id_media_items_id_fk" FOREIGN KEY ("media_item_id") REFERENCES "public"."media_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_episode_links" ADD CONSTRAINT "media_episode_links_episode_id_podcast_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."podcast_episodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "podcast_episodes" ADD CONSTRAINT "podcast_episodes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_discussion" ADD CONSTRAINT "club_discussion_club_read_id_club_reads_id_fk" FOREIGN KEY ("club_read_id") REFERENCES "public"."club_reads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_discussion" ADD CONSTRAINT "club_discussion_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_discussion" ADD CONSTRAINT "club_discussion_parent_id_club_discussion_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."club_discussion"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_discussion" ADD CONSTRAINT "club_discussion_milestone_id_club_schedule_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."club_schedule"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_member_progress" ADD CONSTRAINT "club_member_progress_club_read_id_club_reads_id_fk" FOREIGN KEY ("club_read_id") REFERENCES "public"."club_reads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_member_progress" ADD CONSTRAINT "club_member_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_member_progress" ADD CONSTRAINT "club_member_progress_current_milestone_id_club_schedule_id_fk" FOREIGN KEY ("current_milestone_id") REFERENCES "public"."club_schedule"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_members" ADD CONSTRAINT "club_members_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_members" ADD CONSTRAINT "club_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_reads" ADD CONSTRAINT "club_reads_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_reads" ADD CONSTRAINT "club_reads_media_item_id_media_items_id_fk" FOREIGN KEY ("media_item_id") REFERENCES "public"."media_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_schedule" ADD CONSTRAINT "club_schedule_club_read_id_club_reads_id_fk" FOREIGN KEY ("club_read_id") REFERENCES "public"."club_reads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clubs" ADD CONSTRAINT "clubs_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "media_items_user_active_idx" ON "media_items" USING btree ("user_id","is_active","updated_at");--> statement-breakpoint
CREATE INDEX "media_items_category_idx" ON "media_items" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "media_notes_item_idx" ON "media_notes" USING btree ("media_item_id");--> statement-breakpoint
CREATE INDEX "media_relationships_parent_idx" ON "media_relationships" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "media_relationships_child_idx" ON "media_relationships" USING btree ("child_id");--> statement-breakpoint
CREATE INDEX "media_episode_links_episode_idx" ON "media_episode_links" USING btree ("episode_id");