import "server-only";
import { after } from "next/server";
import { db } from "@/db/client";
import { outboxLog } from "@/db/schema/admin";
import { getFlag, isOwnerUserId } from "./access";
import { env } from "./env";
import { sendToOutbox, type OutboxPlatform } from "./sender-outbox";

/** Effective master switch: the DB flag wins, falling back to the env kill-switch. */
async function outboxMasterOn(): Promise<boolean> {
  return getFlag("outbox_enabled", env.OUTBOX_TRIGGER_ENABLED === "true");
}

// The layered-gate helper (per witus-outbox INTEGRATE.md). Every outbox post goes
// through fireOutboxDrafts so the three gates and the "never log content" rule live
// in exactly one place. Triggers below build per-platform captions and call it.
//
//   Gate 1 — OUTBOX_TRIGGER_ENABLED !== "true"  → return (master kill-switch, default off)
//   Gate 2 — the triggering user is not the owner → return (owner resolved by email
//            via OWNER_EMAIL, or the legacy PRODUCT_OWNER_USER_ID)
//   Gate 3 — fire inside Next after() so the user response is never blocked

const PLATFORMS: readonly OutboxPlatform[] = ["linkedin", "twitter", "bluesky", "instagram"];

interface DraftSpec {
  /** Stable per-event base; the platform is appended → the idempotency key. */
  externalRefBase: string;
  /** Per-platform caption. A platform with no caption here is skipped. */
  captions: Partial<Record<OutboxPlatform, string>>;
  /** Public https media (cover/art). Instagram is skipped when this is empty. */
  mediaUrls?: string[];
  /** Per-show override of the outbox source (multi-show podcasts, plans/04). */
  sourceSlug?: string;
  hmacSecret?: string;
  /** Which trigger fired — gates on the per-trigger admin toggle + labels the log. */
  triggerKey?: string;
}

function fireOutboxDrafts(triggerUserId: string, spec: DraftSpec): void {
  const outboxUrl = env.OUTBOX_INGEST_URL;
  const sourceSlug = spec.sourceSlug ?? env.OUTBOX_SOURCE_SLUG;
  const hmacSecret = spec.hmacSecret ?? env.OUTBOX_INGEST_SECRET;
  if (!outboxUrl || !sourceSlug || !hmacSecret) return;
  const media = spec.mediaUrls ?? [];

  after(async () => {
    // Gates (owner + master + per-trigger) resolve against the DB, so run them here.
    if (!(await outboxMasterOn())) return; // master kill-switch (DB, env fallback)
    if (spec.triggerKey && !(await getFlag(`outbox_trigger_${spec.triggerKey}`, true))) return;
    if (!(await isOwnerUserId(triggerUserId))) return;
    // Drafts: outbox waives the lead-time check; the placeholder is replaced when
    // BAM promotes the draft in /outbox/[id].
    const scheduledAt = new Date(Date.now() + 7 * 24 * 60 * 60_000).toISOString();
    for (const platform of PLATFORMS) {
      const caption = spec.captions[platform];
      if (!caption) continue;
      const externalRef = `${spec.externalRefBase}-${platform}`;
      // Instagram requires an image; skip (and log the skip — never silent) when none.
      if (platform === "instagram" && media.length === 0) {
        console.log("[outbox] skip instagram (no media)", { source: sourceSlug, external_ref: externalRef });
        continue;
      }
      const result = await sendToOutbox({
        outboxUrl,
        sourceSlug,
        hmacSecret,
        submission: {
          external_ref: externalRef,
          platform,
          caption,
          media_urls: media,
          scheduled_at: scheduledAt,
          as_draft: true,
        },
      });
      // Iron rule: record only source/platform/external_ref/http_status — never
      // caption/secret/sig. Persist to outbox_log for the admin activity view.
      await db
        .insert(outboxLog)
        .values({ source: sourceSlug, platform, externalRef, httpStatus: result.status, ok: result.ok })
        .catch(() => {});
      if (!result.ok) {
        console.error("[outbox] failed", { source: sourceSlug, platform, external_ref: externalRef, http_status: result.status });
      }
    }
  });
}

const oneLiner = (s: string) => s.replace(/\s+/g, " ").trim();
const appUrl = () => env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");

const FINISH_VERB: Record<string, string> = {
  book: "reading", article: "reading", art: "viewing",
  movie: "watching", tv_show: "watching", video: "watching",
  song: "listening to", album: "listening to", podcast: "listening to",
};

// ── Trigger: finished a media item (any type) ────────────────────────────────
export function fireMediaFinished(
  triggerUserId: string,
  item: { id: string; title: string; creator: string | null; mediaType: string; rating: number | null; coverImageUrl: string | null },
): void {
  const verb = FINISH_VERB[item.mediaType] ?? "with";
  const by = item.creator ? ` by ${item.creator}` : "";
  const stars = item.rating ? ` ${"★".repeat(item.rating)}` : "";
  const oneline = oneLiner(`Just finished ${verb} "${item.title}"${by}.${stars}`);
  fireOutboxDrafts(triggerUserId, {
    externalRefBase: `media-${item.id}`,
    triggerKey: "finished_media",
    mediaUrls: item.coverImageUrl ? [item.coverImageUrl] : [],
    captions: {
      linkedin: oneLiner(`Just finished ${verb} "${item.title}"${by}.${stars}\n\nTracked on Stream.WitUS.`),
      twitter: oneline,
      bluesky: oneline,
      instagram: oneline,
    },
  });
}

// ── Trigger: an All The Spoilers episode was published ───────────────────────
export function fireEpisodePublished(
  triggerUserId: string,
  episode: { id: string; title: string; episodeNumber: number | null },
): void {
  const url = `${appUrl()}/episodes/${episode.id}`;
  const num = episode.episodeNumber != null ? ` (#${episode.episodeNumber})` : "";
  const oneline = oneLiner(`New All The Spoilers${num}: "${episode.title}". ${url}`);
  fireOutboxDrafts(triggerUserId, {
    externalRefBase: `episode-${episode.id}`,
    triggerKey: "episode_published",
    captions: {
      linkedin: oneLiner(`New All The Spoilers episode${num}: "${episode.title}".\n\nShow notes: ${url}`),
      twitter: oneline,
      bluesky: oneline,
      // instagram skipped automatically (episodes carry no artwork URL)
    },
  });
}

// ── Trigger: a multi-show podcast episode was published ──────────────────────
// Absorbed from witus.online (plans/03). Resolves the show's outbox slug + secret
// from its env keys, mirroring witus.online's SHOW_CONFIG. Captions: LinkedIn long
// form + Twitter/Bluesky one-liner (matching the source; no Instagram).
export function firePodcastEpisode(
  triggerUserId: string,
  episode: {
    id: string;
    title: string;
    episodeNumber: number | null;
    showNotesExcerpt: string | null;
    artworkUrl: string | null;
    listenUrl: string | null; // disctopia / external url
  },
  show: { name: string; outboxSlugEnvKey: string | null; outboxSecretEnvKey: string | null },
): void {
  // Master/owner/per-trigger gating happens in fireOutboxDrafts (DB-backed).
  const sourceSlug = show.outboxSlugEnvKey ? process.env[show.outboxSlugEnvKey] : undefined;
  const hmacSecret = show.outboxSecretEnvKey ? process.env[show.outboxSecretEnvKey] : undefined;
  if (!sourceSlug || !hmacSecret) {
    console.error("[podcast-trigger] missing outbox slug/secret for show", {
      slug_env_key: show.outboxSlugEnvKey,
      secret_env_key: show.outboxSecretEnvKey,
    });
    return;
  }
  const num = episode.episodeNumber != null ? ` (#${episode.episodeNumber})` : "";
  const listen = episode.listenUrl ? `\nListen: ${episode.listenUrl}` : "";
  const oneline = oneLiner(
    `New ${show.name} episode: "${episode.title}".${episode.listenUrl ? ` ${episode.listenUrl}` : ""}`,
  );
  const long = [
    `New ${show.name} episode${num}: "${episode.title}"`,
    episode.showNotesExcerpt ?? "",
    listen.trim(),
  ]
    .filter(Boolean)
    .join("\n\n");

  fireOutboxDrafts(triggerUserId, {
    externalRefBase: `episode-${episode.id}`,
    triggerKey: "episode_published",
    sourceSlug,
    hmacSecret,
    mediaUrls: episode.artworkUrl ? [episode.artworkUrl] : [],
    captions: { linkedin: long, twitter: oneline, bluesky: oneline },
  });
}

// ── Trigger: a public club started a new read ────────────────────────────────
export function fireClubNewRead(
  triggerUserId: string,
  read: { id: string; title: string; coverImageUrl: string | null },
  club: { name: string },
): void {
  const oneline = oneLiner(`${club.name} is now reading "${read.title}".`);
  fireOutboxDrafts(triggerUserId, {
    externalRefBase: `clubread-${read.id}`,
    triggerKey: "club_read",
    mediaUrls: read.coverImageUrl ? [read.coverImageUrl] : [],
    captions: {
      linkedin: oneLiner(`${club.name} (a ReadWitUS book club) is now reading "${read.title}". Join the conversation.`),
      twitter: oneline,
      bluesky: oneline,
      instagram: oneline,
    },
  });
}
