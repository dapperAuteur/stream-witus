import { type NextRequest, NextResponse } from "next/server";
import { publishAdminEpisode } from "@/db/episodes-admin";
import { logAdminAction } from "@/lib/admin-data";
import { notFound } from "@/lib/api";
import { firePodcastEpisode } from "@/lib/outbox-trigger";
import { getOwnerUser } from "@/lib/session";

type Params = { params: Promise<{ id: string }> };

// Publish (status→published) and fire the per-show outbox draft (gated + after()).
// Idempotent via external_ref (episode-<id>) so a re-publish won't duplicate.
export async function POST(_request: NextRequest, { params }: Params) {
  const user = await getOwnerUser();
  if (!user) return notFound();
  const { id } = await params;

  const result = await publishAdminEpisode(user.id, id);
  if (!result) return notFound();
  const { episode, show } = result;
  await logAdminAction(user, "episode.publish", { targetType: "episode", targetId: id, meta: { show: show?.slug ?? null } });

  if (show) {
    firePodcastEpisode(
      user.id,
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
