'use client';

import { useEffect, useState, useCallback } from 'react';
import { Loader2 } from 'lucide-react';

interface Show {
  id: string; slug: string; name: string;
  description: string | null; author: string | null; ownerEmail: string | null;
  category: string | null; language: string; explicit: boolean; artworkUrl: string | null;
}

const input = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm';

function ShowRow({ show, onSave }: { show: Show; onSave: () => void }) {
  const [f, setF] = useState(show);
  const [saving, setSaving] = useState(false);
  const feedUrl = `/feed/podcast/${show.slug}/rss.xml`;
  // Apple/Spotify need these before cutover.
  const ready = Boolean(f.category && f.ownerEmail && f.artworkUrl && f.description);

  const save = async () => {
    setSaving(true);
    await fetch('/api/admin/shows', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: show.id, description: f.description, author: f.author, owner_email: f.ownerEmail,
        category: f.category, explicit: f.explicit, artwork_url: f.artworkUrl,
      }),
    });
    setSaving(false);
    onSave();
  };

  return (
    <div className="border border-gray-100 rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-gray-800">{show.name}</h3>
        <span className={`text-[10px] px-1.5 py-0.5 rounded ${ready ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
          {ready ? 'feed-ready' : 'needs config'}
        </span>
        <a href={feedUrl} target="_blank" rel="noopener noreferrer" className="ml-auto text-xs text-fuchsia-600 hover:underline font-mono">{feedUrl}</a>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input className={input} placeholder="iTunes category (e.g. TV & Film)" value={f.category ?? ''} onChange={(e) => setF({ ...f, category: e.target.value })} />
        <input className={input} type="email" placeholder="Owner email" value={f.ownerEmail ?? ''} onChange={(e) => setF({ ...f, ownerEmail: e.target.value })} />
        <input className={input} placeholder="Author" value={f.author ?? ''} onChange={(e) => setF({ ...f, author: e.target.value })} />
        <input className={input} type="url" placeholder="Artwork URL (https, ≥1400px)" value={f.artworkUrl ?? ''} onChange={(e) => setF({ ...f, artworkUrl: e.target.value })} />
      </div>
      <textarea className={input} rows={2} placeholder="Channel description" value={f.description ?? ''} onChange={(e) => setF({ ...f, description: e.target.value })} />
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1.5 text-xs text-gray-600">
          <input type="checkbox" checked={f.explicit} onChange={(e) => setF({ ...f, explicit: e.target.checked })} className="rounded border-gray-300 text-fuchsia-600 focus:ring-fuchsia-500" />
          Explicit
        </label>
        <button onClick={save} disabled={saving} className="ml-auto px-3 py-1.5 bg-fuchsia-600 text-white rounded-lg text-xs font-medium hover:bg-fuchsia-700 disabled:opacity-50">
          {saving ? 'Saving…' : 'Save config'}
        </button>
      </div>
    </div>
  );
}

export default function ShowsPanel() {
  const [shows, setShows] = useState<Show[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/admin/shows');
    if (res.ok) setShows((await res.json()).shows || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <section className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-gray-700">Shows &amp; podcast feeds</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Set the iTunes channel config, then validate each feed before pointing Apple/Spotify at it (the cutover).
        </p>
      </div>
      {loading ? (
        <div className="py-6 flex justify-center"><Loader2 className="animate-spin h-5 w-5 text-fuchsia-600" /></div>
      ) : (
        <div className="space-y-2">
          {shows.map((s) => <ShowRow key={s.id} show={s} onSave={load} />)}
        </div>
      )}
    </section>
  );
}
