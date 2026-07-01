import { type NextRequest, NextResponse } from "next/server";
import { publishAdminEpisode } from "@/db/episodes-admin";
import { getOwnerUserId } from "@/lib/access";
import { logAdminAction } from "@/lib/admin-data";
import { notFound } from "@/lib/api";
import { firePodcastEpisode } from "@/lib/outbox-trigger";
import { canModerate, requireAdmin } from "@/lib/session";

type Params = { params: Promise<{ id: string }> };

// Publish (status→published) and fire the per-show outbox draft (gated + after()).
// Idempotent via external_ref (episode-<id>) so a re-publish won't duplicate.
export async function POST(_request: NextRequest, { params }: Params) {
  const admin = await requireAdmin(canModerate);
  if (!admin) return notFound();
  const oid = (await getOwnerUserId()) ?? "";
  const { id } = await params;

  const result = await publishAdminEpisode(oid, id);
  if (!result) return notFound();
  const { episode, show } = result;
  await logAdminAction(admin, "episode.publish", { targetType: "episode", targetId: id, meta: { show: show?.slug ?? null } });

  if (show) {
    firePodcastEpisode(
      oid,
      {
        id: episode.id,
        title: episode.title,
        episodeNumber: episode.episodeNumber,
        showNotesExcerpt: episode.showNotesExcerpt,
        artworkUrl: episode.artworkUrl,
        listenUrl: episode.externalUrl,
      },
      { name: show.name, outboxSlugEnvKey: show.outboxSlugEnvKey, outboxSecretEnvKey: show.outboxSecretEnvKey },
    );
  }

  return NextResponse.json({ episode });
}
