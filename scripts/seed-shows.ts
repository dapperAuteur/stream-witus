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

const WFC_FEED = "https://play.disctopia.com/podcast/rss?channel=bam_worlds_fastest_centenarian";

const SHOWS = [
  {
    // All The Spoilers is a segment of the WFC podcast (same Disctopia channel),
    // so it publishes through WFC's outbox source + feed (plans/04 follow-up).
    // Kept as its own row so the companion label / media_episode_links stay intact.
    slug: "all-the-spoilers",
    name: "All The Spoilers",
    outboxSlugEnvKey: "OUTBOX_PODCAST_WFC_SLUG",
    outboxSecretEnvKey: "OUTBOX_PODCAST_WFC_SECRET",
    feedUrl: WFC_FEED,
  },
  {
    slug: "wfc",
    name: "World's Fastest Centenarian",
    outboxSlugEnvKey: "OUTBOX_PODCAST_WFC_SLUG",
    outboxSecretEnvKey: "OUTBOX_PODCAST_WFC_SECRET",
    feedUrl: WFC_FEED,
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
  // Upsert so re-running reconciles env keys / feed on existing rows (idempotent).
  for (const s of SHOWS) {
    await db
      .insert(schema.podcastShows)
      .values(s)
      .onConflictDoUpdate({
        target: schema.podcastShows.slug,
        set: {
          name: s.name,
          outboxSlugEnvKey: s.outboxSlugEnvKey,
          outboxSecretEnvKey: s.outboxSecretEnvKey,
          feedUrl: s.feedUrl,
          updatedAt: new Date(),
        },
      });
  }

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
