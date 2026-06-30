import { neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { eq } from "drizzle-orm";
import ws from "ws";
import * as schema from "../src/db/schema";
import { resolveDbUrl } from "./db-url";

neonConfig.webSocketConstructor = ws;

const connectionString = resolveDbUrl(true);
if (!connectionString || connectionString.includes("placeholder")) {
  console.error("Database URL is not set. Put a real Neon connection string in .env.local.");
  process.exit(1);
}

const pool = new Pool({ connectionString });
const db = drizzle(pool, { schema, casing: "snake_case" });

// Deterministic dev owner so re-seeding is idempotent. In real use, sign in via
// magic link and better-auth provisions the user; this is only for local dev data.
const SEED_USER_ID = "seed-owner-0001";
const SEED_EMAIL = "owner@stream.witus.online";

const DEFAULT_CATEGORIES = [
  { name: "Books", icon: "book", color: "#8b5cf6", sortOrder: 0 },
  { name: "TV & Film", icon: "film", color: "#ec4899", sortOrder: 1 },
  { name: "Music", icon: "music", color: "#06b6d4", sortOrder: 2 },
  { name: "Podcasts", icon: "mic", color: "#f59e0b", sortOrder: 3 },
  { name: "Art", icon: "palette", color: "#10b981", sortOrder: 4 },
  { name: "Other", icon: "circle", color: "#6b7280", sortOrder: 5 },
];

async function main() {
  console.log("Seeding dev owner, categories, a sample item, and a sample episode …");

  await db
    .insert(schema.users)
    .values({ id: SEED_USER_ID, email: SEED_EMAIL, emailVerified: true, name: "Stream Owner" })
    .onConflictDoNothing();

  await db
    .insert(schema.mediaCategories)
    .values(DEFAULT_CATEGORIES.map((c) => ({ ...c, userId: SEED_USER_ID })))
    .onConflictDoNothing();

  const [booksCat] = await db
    .select()
    .from(schema.mediaCategories)
    .where(eq(schema.mediaCategories.name, "Books"))
    .limit(1);

  await db
    .insert(schema.mediaItems)
    .values({
      userId: SEED_USER_ID,
      title: "Project Hail Mary",
      creator: "Andy Weir",
      mediaType: "book",
      status: "completed",
      rating: 5,
      categoryId: booksCat?.id ?? null,
      visibility: "public",
      yearReleased: 2021,
      isFavorite: true,
    })
    .onConflictDoNothing();

  await db
    .insert(schema.podcastEpisodes)
    .values({
      userId: SEED_USER_ID,
      title: "All The Spoilers — Pilot",
      episodeNumber: 1,
      status: "published",
      visibility: "public",
      description: "The first episode. Sample seed data.",
    })
    .onConflictDoNothing();

  console.log("Seed complete.");
  await pool.end();
}

main().catch((error) => {
  console.error("Seed failed:", error);
  pool.end().finally(() => process.exit(1));
});
