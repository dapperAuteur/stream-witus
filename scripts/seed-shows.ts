import { neonConfig, Pool } from "@neondatabase/serverless";
import { eq, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "../src/db/schema";
import { resolveDbUrl } from "./db-url";

neonConfig.webSocketConstructor = ws;

// Seed the three podcast shows and backfill existing episodes to All The Spoilers.
// Idempotent — safe to re-run. See plans/04-decisions-podcast-multishow.md.
const connectionString = resolveDbUrl(true);
if (!connectionString || connectionString.includes("placeholder")) {
  console.error("Database URL is not set. Put a real Neon connection string in .env.local.");
  process.exit(1);
}
const pool = new Pool({ connectionString });
const db = drizzle(pool, { schema, casing: "snake_case" });

const SHOWS = [
  {
    slug: "all-the-spoilers",
    name: "All The Spoilers",
    outboxSlugEnvKey: "OUTBOX_SOURCE_SLUG",
    outboxSecretEnvKey: "OUTBOX_INGEST_SECRET",
    feedUrl: null,
  },
  {
    slug: "wfc",
    name: "World's Fastest Centenarian",
    outboxSlugEnvKey: "OUTBOX_PODCAST_WFC_SLUG",
    outboxSecretEnvKey: "OUTBOX_PODCAST_WFC_SECRET",
    feedUrl: "https://play.disctopia.com/podcast/rss?channel=bam_worlds_fastest_centenarian",
  },
  {
    slug: "aamsaz",
    name: "African American Museum of Southern Arizona Podcast",
    outboxSlugEnvKey: "OUTBOX_PODCAST_AAMSAZ_SLUG",
    outboxSecretEnvKey: "OUTBOX_PODCAST_AAMSAZ_SECRET",
    feedUrl:
      "https://play.disctopia.com/podcast/rss?channel=african-american-museum-of-southern-arizona-podcast",
  },
];

async function main() {
  await db.insert(schema.podcastShows).values(SHOWS).onConflictDoNothing({ target: schema.podcastShows.slug });

  const [ats] = await db
    .select({ id: schema.podcastShows.id })
    .from(schema.podcastShows)
    .where(eq(schema.podcastShows.slug, "all-the-spoilers"))
    .limit(1);

  if (ats) {
    const backfilled = await db
      .update(schema.podcastEpisodes)
      .set({ showId: ats.id })
      .where(isNull(schema.podcastEpisodes.showId))
      .returning({ id: schema.podcastEpisodes.id });
    console.log(`Seeded 3 shows; backfilled ${backfilled.length} existing episode(s) → all-the-spoilers.`);
  }
  await pool.end();
}

main().catch((error) => {
  console.error("seed-shows failed:", error);
  pool.end().finally(() => process.exit(1));
});
