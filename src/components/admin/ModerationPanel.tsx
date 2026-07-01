'use client';

import { useEffect, useState, useCallback } from 'react';
import { Loader2, Star } from 'lucide-react';

interface Club { id: string; slug: string; name: string; featured: boolean }
interface Post {
  id: string; body: string; removed: boolean; isSpoiler: boolean; createdAt: string;
  authorName: string | null; authorEmail: string | null; clubName: string | null; readTitle: string | null;
}

export default function ModerationPanel() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [c, p] = await Promise.all([fetch('/api/admin/clubs'), fetch('/api/admin/posts')]);
    if (c.ok) setClubs((await c.json()).clubs || []);
    if (p.ok) setPosts((await p.json()).posts || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const feature = async (id: string, featured: boolean) => {
    setClubs((cs) => cs.map((c) => (c.id === id ? { ...c, featured } : c)));
    await fetch('/api/admin/clubs', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, featured }) });
  };

  const takedown = async (id: string, removed: boolean) => {
    if (removed && !confirm('Remove this post from members? (Reversible — kept for audit.)')) return;
    setPosts((ps) => ps.map((p) => (p.id === id ? { ...p, removed } : p)));
    await fetch('/api/admin/posts', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, removed }) });
  };

  if (loading) return <div className="py-16 flex justify-center"><Loader2 className="animate-spin h-6 w-6 text-fuchsia-600" /></div>;

  return (
    <div className="space-y-6">
      <section className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Public clubs</h2>
        {clubs.length === 0 ? (
          <p className="text-xs text-gray-400">No public clubs yet.</p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {clubs.map((c) => (
              <li key={c.id} className="flex items-center gap-2 py-2">
                <span className="min-w-0 flex-1 text-sm text-gray-800 truncate">{c.name}</span>
                <button onClick={() => feature(c.id, !c.featured)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium ${c.featured ? 'bg-fuchsia-600 text-white hover:bg-fuchsia-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  <Star className={`w-3 h-3 ${c.featured ? 'fill-white' : ''}`} /> {c.featured ? 'Featured' : 'Feature'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Recent discussion posts</h2>
        {posts.length === 0 ? (
          <p className="text-xs text-gray-400">No posts yet.</p>
        ) : (
          <ul className="space-y-2">
            {posts.map((p) => (
              <li key={p.id} className={`rounded-lg border p-3 ${p.removed ? 'border-dashed border-red-200 bg-red-50/40' : 'border-gray-100'}`}>
                <div className="flex items-center gap-2 mb-1 text-xs text-gray-500">
                  <span className="font-medium text-gray-700">{p.authorName || p.authorEmail}</span>
                  {p.clubName && <span>· {p.clubName}</span>}
                  {p.readTitle && <span className="truncate">· {p.readTitle}</span>}
                  {p.isSpoiler && <span className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded">spoiler</span>}
                  <button onClick={() => takedown(p.id, !p.removed)}
                    className={`ml-auto px-2 py-0.5 rounded text-[11px] font-medium shrink-0 ${p.removed ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}>
                    {p.removed ? 'Restore' : 'Remove'}
                  </button>
                </div>
                <p className={`text-sm whitespace-pre-wrap ${p.removed ? 'text-gray-400 italic' : 'text-gray-700'}`}>{p.body}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
