import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicEpisode, listPublicEpisodeMedia } from "@/db/public";

// Reads the episode live per request (visibility can change; no stale prerender).
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const TYPE_ICONS: Record<string, string> = {
  book: "\u{1F4D6}", tv_show: "\u{1F4FA}", movie: "\u{1F3AC}", video: "\u{1F4F9}",
  song: "\u{1F3B5}", album: "\u{1F4BF}", podcast: "\u{1F399}", art: "\u{1F3A8}",
  article: "\u{1F4F0}", other: "\u{1F4E6}",
};

function epTag(season: number | null, num: number | null): string | null {
  if (num == null) return null;
  return season != null ? `S${season}E${num}` : `#${num}`;
}

function fmtDate(d: string | null): string | null {
  if (!d) return null;
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// SEO: only public episodes get metadata; private/missing → noindex defaults.
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const ep = await getPublicEpisode(id);
  if (!ep) return { title: "Episode not found · Stream.WitUS", robots: { index: false } };
  const tag = epTag(ep.seasonNumber, ep.episodeNumber);
  const title = `${tag ? `${tag} — ` : ""}${ep.title} · All The Spoilers`;
  const description = ep.description ?? ep.showNotes?.slice(0, 160) ?? "Show notes on Stream.WitUS.";
  return {
    title,
    description,
    openGraph: { title, description, type: "article" },
    twitter: { card: "summary", title, description },
  };
}

export default async function PublicEpisodePage({ params }: Params) {
  const { id } = await params;
  const ep = await getPublicEpisode(id);
  if (!ep) notFound();

  const media = await listPublicEpisodeMedia(id);
  const tag = epTag(ep.seasonNumber, ep.episodeNumber);
  const aired = fmtDate(ep.airDate);

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <Link href="/episodes" className="text-sm text-neutral-400 hover:text-white">
        ← All episodes
      </Link>

      <header className="mt-6 space-y-2">
        <div className="flex items-center gap-2 text-xs text-neutral-500">
          <span className="rounded bg-fuchsia-600/20 px-2 py-0.5 font-medium text-fuchsia-300">
            All The Spoilers
          </span>
          {tag && <span className="font-mono">{tag}</span>}
          {aired && <span>{aired}</span>}
        </div>
        <h1 className="text-3xl font-bold">{ep.title}</h1>
        {ep.description && <p className="text-neutral-300">{ep.description}</p>}
      </header>

      {ep.showNotes && (
        <section className="mt-8">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-neutral-400">
            Show notes
          </h2>
          <div className="whitespace-pre-wrap text-[15px] leading-relaxed text-neutral-200">
            {ep.showNotes}
          </div>
        </section>
      )}

      {media.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-400">
            Discussed in this episode
          </h2>
          <ul className="space-y-2">
            {media.map((m) => (
              <li
                key={m.id}
                className="flex items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-900/60 p-3"
              >
                {m.coverImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.coverImageUrl} alt="" className="h-14 w-10 shrink-0 rounded object-cover" />
                ) : (
                  <div className="flex h-14 w-10 shrink-0 items-center justify-center rounded bg-neutral-800 text-lg">
                    {TYPE_ICONS[m.mediaType] ?? "\u{1F4E6}"}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-white">{m.title}</p>
                  <p className="truncate text-sm text-neutral-400">
                    {[m.creator, m.mediaType.replace("_", " ")].filter(Boolean).join(" · ")}
                  </p>
                  {m.discussionNotes && (
                    <p className="mt-0.5 text-xs text-neutral-500">{m.discussionNotes}</p>
                  )}
                </div>
                {m.timestampStart && (
                  <span className="shrink-0 rounded bg-neutral-800 px-2 py-1 font-mono text-xs text-neutral-300">
                    {m.timestampStart}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="mt-12 border-t border-neutral-800 pt-6 text-xs text-neutral-500">
        Tracked on <Link href="/" className="text-fuchsia-400 hover:underline">Stream.WitUS</Link>
      </footer>
    </main>
  );
}
