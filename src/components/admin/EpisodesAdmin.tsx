'use client';

import { useEffect, useState, useCallback } from 'react';
import { Loader2, Upload, Plus, Send } from 'lucide-react';

interface Show { id: string; slug: string; name: string; feedUrl: string | null }
interface Episode {
  id: string; title: string; episodeNumber: number | null; status: string;
  showSlug: string | null; showName: string | null;
}
interface PreviewItem { guid: string; title: string; willInsert: boolean; hasHttpsArtwork: boolean }

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  recorded: 'bg-amber-100 text-amber-700',
  published: 'bg-green-100 text-green-700',
};

const input = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm';

export default function EpisodesAdmin() {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [shows, setShows] = useState<Show[]>([]);
  const [loading, setLoading] = useState(true);

  // import
  const [impShow, setImpShow] = useState('');
  const [feedUrl, setFeedUrl] = useState('');
  const [preview, setPreview] = useState<{ items: PreviewItem[]; newCount: number; skipCount: number; channelTitle: string } | null>(null);
  const [importing, setImporting] = useState(false);
  const [impMsg, setImpMsg] = useState('');

  // create
  const [showCreate, setShowCreate] = useState(false);
  const [cForm, setCForm] = useState({ show_id: '', title: '', episode_number: '', show_notes_excerpt: '', artwork_url: '', external_url: '', show_notes: '' });

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/admin/episodes');
    if (res.ok) {
      const d = await res.json();
      setEpisodes(d.episodes || []);
      setShows(d.shows || []);
      if (d.shows?.[0] && !impShow) setImpShow(d.shows[0].id);
    }
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  const onImpShowChange = (id: string) => {
    setImpShow(id);
    setPreview(null);
    const s = shows.find((x) => x.id === id);
    setFeedUrl(s?.feedUrl ?? '');
  };

  const runImport = async (mode: 'preview' | 'commit') => {
    if (!impShow || !feedUrl.trim()) return;
    setImporting(true); setImpMsg('');
    const res = await fetch('/api/admin/episodes/import', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, show_id: impShow, feed_url: feedUrl.trim() }),
    });
    const d = await res.json();
    if (!res.ok) { setImpMsg(d.error || 'Import failed'); setImporting(false); return; }
    if (mode === 'preview') setPreview(d);
    else { setImpMsg(`Imported ${d.inserted} as draft · skipped ${d.skipped}${d.failed?.length ? ` · ${d.failed.length} failed` : ''}`); setPreview(null); load(); }
    setImporting(false);
  };

  const publish = async (id: string) => {
    if (!confirm('Publish this episode? This fires a social draft to the outbox.')) return;
    const res = await fetch(`/api/admin/episodes/${id}/publish`, { method: 'POST' });
    if (res.ok) load();
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cForm.show_id || !cForm.title.trim()) return;
    const res = await fetch('/api/admin/episodes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        show_id: cForm.show_id, title: cForm.title.trim(),
        episode_number: cForm.episode_number ? parseInt(cForm.episode_number) : null,
        show_notes_excerpt: cForm.show_notes_excerpt.trim() || null,
        artwork_url: cForm.artwork_url.trim() || null,
        external_url: cForm.external_url.trim() || null,
        show_notes: cForm.show_notes.trim() || null,
      }),
    });
    if (res.ok) { setShowCreate(false); setCForm({ show_id: '', title: '', episode_number: '', show_notes_excerpt: '', artwork_url: '', external_url: '', show_notes: '' }); load(); }
  };

  if (loading) return <div className="py-16 flex justify-center"><Loader2 className="animate-spin h-6 w-6 text-fuchsia-600" /></div>;

  return (
    <div className="space-y-6">
      {/* Import */}
      <section className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5"><Upload className="w-4 h-4" /> Import from Disctopia</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <select value={impShow} onChange={(e) => onImpShowChange(e.target.value)} className={input} aria-label="Show">
            {shows.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input value={feedUrl} onChange={(e) => setFeedUrl(e.target.value)} placeholder="Disctopia RSS feed URL" className={`${input} sm:col-span-2`} />
        </div>
        <div className="flex gap-2">
          <button onClick={() => runImport('preview')} disabled={importing || !feedUrl.trim()}
            className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-50 min-h-11">
            {importing ? 'Working…' : 'Preview'}
          </button>
          {preview && preview.newCount > 0 && (
            <button onClick={() => runImport('commit')} disabled={importing}
              className="px-3 py-2 bg-fuchsia-600 text-white rounded-lg text-sm font-medium hover:bg-fuchsia-700 disabled:opacity-50 min-h-11">
              Import {preview.newCount} as draft
            </button>
          )}
        </div>
        {impMsg && <p className="text-sm text-gray-600">{impMsg}</p>}
        {preview && (
          <p className="text-xs text-gray-500">
            {preview.channelTitle}: {preview.newCount} new, {preview.skipCount} already imported / no https artwork.
          </p>
        )}
      </section>

      {/* Episodes list */}
      <section className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Episodes ({episodes.length})</h2>
          <button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-1 text-xs text-fuchsia-600 hover:text-fuchsia-700 font-medium min-h-11">
            <Plus className="w-3.5 h-3.5" /> New
          </button>
        </div>

        {showCreate && (
          <form onSubmit={create} className="border border-gray-100 rounded-lg p-3 space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <select value={cForm.show_id} onChange={(e) => setCForm((f) => ({ ...f, show_id: e.target.value }))} required className={input} aria-label="Show">
                <option value="">Show…</option>
                {shows.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <input value={cForm.title} onChange={(e) => setCForm((f) => ({ ...f, title: e.target.value }))} placeholder="Title" required className={`${input} sm:col-span-2`} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input value={cForm.episode_number} onChange={(e) => setCForm((f) => ({ ...f, episode_number: e.target.value }))} type="number" placeholder="Episode #" className={input} />
              <input value={cForm.artwork_url} onChange={(e) => setCForm((f) => ({ ...f, artwork_url: e.target.value }))} type="url" placeholder="Artwork URL (https)" className={`${input} sm:col-span-2`} />
            </div>
            <input value={cForm.external_url} onChange={(e) => setCForm((f) => ({ ...f, external_url: e.target.value }))} type="url" placeholder="Listen / Disctopia URL" className={input} />
            <input value={cForm.show_notes_excerpt} onChange={(e) => setCForm((f) => ({ ...f, show_notes_excerpt: e.target.value }))} placeholder="Show-notes excerpt (used in the social caption)" className={input} />
            <textarea value={cForm.show_notes} onChange={(e) => setCForm((f) => ({ ...f, show_notes: e.target.value }))} rows={2} placeholder="Show notes" className={input} />
            <button type="submit" className="px-3 py-2 bg-fuchsia-600 text-white rounded-lg text-sm font-medium hover:bg-fuchsia-700 min-h-11">Create draft</button>
          </form>
        )}

        {episodes.length === 0 ? (
          <p className="text-xs text-gray-400">No episodes yet — import from Disctopia or add one.</p>
        ) : (
          <div className="space-y-1.5">
            {episodes.map((ep) => (
              <div key={ep.id} className="flex items-center gap-2 border border-gray-100 rounded-lg p-2.5">
                <span className="text-[10px] bg-gray-50 border border-gray-200 rounded px-1.5 py-0.5 text-gray-500 shrink-0">{ep.showSlug ?? '—'}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {ep.episodeNumber != null && <span className="text-gray-400 font-mono mr-1">#{ep.episodeNumber}</span>}
                    {ep.title}
                  </p>
                </div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${STATUS_BADGE[ep.status] ?? STATUS_BADGE.draft}`}>{ep.status}</span>
                {ep.status !== 'published' && (
                  <button onClick={() => publish(ep.id)} className="flex items-center gap-1 px-2 py-1 bg-fuchsia-600 text-white rounded text-xs font-medium hover:bg-fuchsia-700 shrink-0">
                    <Send className="w-3 h-3" /> Publish
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
