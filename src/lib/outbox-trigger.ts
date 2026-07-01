import "server-only";
import { after } from "next/server";
import { isOwnerUserId } from "./access";
import { env, outboxEnabled } from "./env";
import { sendToOutbox, type OutboxPlatform } from "./sender-outbox";

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
}

function fireOutboxDrafts(triggerUserId: string, spec: DraftSpec): void {
  if (!outboxEnabled) return; // Gate 1 (kill-switch)
  const outboxUrl = env.OUTBOX_INGEST_URL;
  const sourceSlug = env.OUTBOX_SOURCE_SLUG;
  const hmacSecret = env.OUTBOX_INGEST_SECRET;
  if (!outboxUrl || !sourceSlug || !hmacSecret) return;
  const media = spec.mediaUrls ?? [];

  after(async () => {
    // Gate 2 (owner-only) — resolved by email, so it needs a DB read; do it here.
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
      // Iron rule: log only source/platform/external_ref/http_status — never caption/secret/sig.
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
    captions: {
      linkedin: oneLiner(`New All The Spoilers episode${num}: "${episode.title}".\n\nShow notes: ${url}`),
      twitter: oneline,
      bluesky: oneline,
      // instagram skipped automatically (episodes carry no artwork URL)
    },
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
    mediaUrls: read.coverImageUrl ? [read.coverImageUrl] : [],
    captions: {
      linkedin: oneLiner(`${club.name} (a ReadWitUS book club) is now reading "${read.title}". Join the conversation.`),
      twitter: oneline,
      bluesky: oneline,
      instagram: oneline,
    },
  });
}
