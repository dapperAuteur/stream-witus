import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicClub, listPublicClubReads } from "@/db/public";

// Public club identity + reading list only — discussion is never exposed here.
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

const STATUS_LABEL: Record<string, string> = {
  upcoming: "Upcoming", active: "Reading now", completed: "Completed",
};

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const club = await getPublicClub(slug);
  if (!club) return { title: "Club not found · Stream.WitUS", robots: { index: false } };
  const title = `${club.name} · ReadWitUS`;
  const description = club.description ?? "A ReadWitUS book club on Stream.WitUS.";
  return { title, description, openGraph: { title, description, type: "website" } };
}

export default async function PublicClubPage({ params }: Params) {
  const { slug } = await params;
  const club = await getPublicClub(slug);
  if (!club) notFound();

  const reads = await listPublicClubReads(club.id);

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <p className="text-xs font-medium uppercase tracking-wider text-fuchsia-300">ReadWitUS</p>
      <h1 className="mt-1 text-3xl font-bold">{club.name}</h1>
      {club.description && <p className="mt-2 text-neutral-300">{club.description}</p>}

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-400">
          Reading list
        </h2>
        {reads.length === 0 ? (
          <p className="text-sm text-neutral-500">No reads yet.</p>
        ) : (
          <ul className="space-y-2">
            {reads.map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-900/60 p-3"
              >
                {r.coverImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.coverImageUrl} alt="" className="h-14 w-10 shrink-0 rounded object-cover" />
                ) : (
                  <div className="h-14 w-10 shrink-0 rounded bg-neutral-800" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-white">{r.mediaTitle ?? r.title ?? "Untitled"}</p>
                  {r.mediaCreator && <p className="truncate text-sm text-neutral-400">{r.mediaCreator}</p>}
                </div>
                <span className="shrink-0 rounded bg-neutral-800 px-2 py-1 text-xs text-neutral-300">
                  {STATUS_LABEL[r.status] ?? r.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="mt-12 border-t border-neutral-800 pt-6 text-xs text-neutral-500">
        A book club on <Link href="/" className="text-fuchsia-400 hover:underline">Stream.WitUS</Link>
      </footer>
    </main>
  );
}
