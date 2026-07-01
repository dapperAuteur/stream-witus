import type { Metadata } from "next";
import Link from "next/link";
import { listPublicClubs } from "@/db/public";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Book clubs · ReadWitUS · Stream.WitUS",
  description: "Public ReadWitUS book clubs — spoiler-safe, progress-gated reading groups.",
};

export default async function PublicClubsPage() {
  const clubs = await listPublicClubs();
  const featured = clubs.filter((c) => c.featured);
  const rest = clubs.filter((c) => !c.featured);

  const Card = ({ c }: { c: (typeof clubs)[number] }) => (
    <Link
      href={`/clubs/${c.slug}`}
      className="block rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 transition hover:border-fuchsia-500/50"
    >
      <div className="flex items-center gap-2">
        <h2 className="font-semibold text-white">{c.name}</h2>
        {c.featured && (
          <span className="rounded bg-fuchsia-600/20 px-1.5 py-0.5 text-[10px] font-medium text-fuchsia-300">
            Featured
          </span>
        )}
      </div>
      {c.description && <p className="mt-1 line-clamp-2 text-sm text-neutral-400">{c.description}</p>}
    </Link>
  );

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <header className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wider text-fuchsia-300">ReadWitUS</p>
        <h1 className="text-3xl font-bold">Book clubs</h1>
        <p className="text-neutral-400">Spoiler-safe, progress-gated reading groups.</p>
      </header>

      {clubs.length === 0 ? (
        <p className="mt-10 text-sm text-neutral-500">No public clubs yet.</p>
      ) : (
        <div className="mt-8 space-y-6">
          {featured.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400">Featured</h2>
              <div className="space-y-2">{featured.map((c) => <Card key={c.slug} c={c} />)}</div>
            </section>
          )}
          {rest.length > 0 && (
            <section className="space-y-2">
              {featured.length > 0 && (
                <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400">All clubs</h2>
              )}
              <div className="space-y-2">{rest.map((c) => <Card key={c.slug} c={c} />)}</div>
            </section>
          )}
        </div>
      )}
    </main>
  );
}
