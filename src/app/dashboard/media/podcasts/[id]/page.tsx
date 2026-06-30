'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Trash2, Loader2, Plus, X, Edit3, Globe, Lock, ExternalLink, Check } from 'lucide-react';
import { offlineFetch } from '@/lib/offline/offline-fetch';
import Modal from '@/components/ui/Modal';

interface Episode {
  id: string;
  title: string;
  episode_number: number | null;
  season_number: number | null;
  air_date: string | null;
  description: string | null;
  show_notes: string | null;
  audio_url: string | null;
  external_url: string | null;
  duration_min: number | null;
  status: string;
  visibility: string;
  created_at: string;
}

interface LinkedMedia {
  id: string;
  media_item_id: string;
  discussion_notes: string | null;
  timestamp_start: string | null;
  title: string;
  media_type: string;
  creator: string | null;
  cover_image_url: string | null;
}

interface SearchResult {
  id: string;
  title: string;
  media_type: string;
  creator: string | null;
}

const TYPE_ICONS: Record<string, string> = {
  book: '\u{1F4D6}', tv_show: '\u{1F4FA}', movie: '\u{1F3AC}',
  video: '\u{1F4F9}', song: '\u{1F3B5}', album: '\u{1F4BF}',
  podcast: '\u{1F399}', art: '\u{1F3A8}', article: '\u{1F4F0}', other: '\u{1F4E6}',
};

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-gray-100 text-gray-600' },
  recorded: { label: 'Recorded', className: 'bg-amber-100 text-amber-700' },
  published: { label: 'Published', className: 'bg-green-100 text-green-700' },
};

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const BLANK_EDIT = {
  title: '', episode_number: '', season_number: '', air_date: '',
  status: 'draft', visibility: 'private', description: '', show_notes: '',
};

export default function PodcastEpisodeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [linkedMedia, setLinkedMedia] = useState<LinkedMedia[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [linkTimestamp, setLinkTimestamp] = useState('');

  // Inline timestamp edit per linked row
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const [timestampDraft, setTimestampDraft] = useState('');

  // Episode edit modal
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState(BLANK_EDIT);
  const [savingEdit, setSavingEdit] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [epRes, mediaRes] = await Promise.all([
        offlineFetch(`/api/podcasts/${id}`),
        offlineFetch(`/api/podcasts/${id}/media`),
      ]);
      if (epRes.ok) {
        const d = await epRes.json();
        setEpisode(d.episode || null);
      }
      if (mediaRes.ok) {
        const d = await mediaRes.json();
        setLinkedMedia(d.links || []);
      }
    } catch { /* handled */ }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleSearch = async (q: string) => {
    setSearchQuery(q);
    if (q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await offlineFetch(`/api/media?search=${encodeURIComponent(q)}&limit=10`);
      if (res.ok) {
        const d = await res.json();
        setSearchResults((d.items || []).filter((i: SearchResult) =>
          !linkedMedia.some((l) => l.media_item_id === i.id)
        ));
      }
    } finally { setSearching(false); }
  };

  const handleLinkMedia = async (mediaItemId: string) => {
    const res = await offlineFetch(`/api/podcasts/${id}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ media_item_id: mediaItemId, timestamp_start: linkTimestamp.trim() || null }),
    });
    if (res.ok) {
      setSearchQuery('');
      setSearchResults([]);
      setLinkTimestamp('');
      load();
    }
  };

  const handleSaveTimestamp = async (mediaItemId: string) => {
    const res = await offlineFetch(`/api/podcasts/${id}/media`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ media_item_id: mediaItemId, timestamp_start: timestampDraft.trim() || null }),
    });
    if (res.ok) { setEditingLinkId(null); setTimestampDraft(''); load(); }
  };

  const handleUnlinkMedia = async (mediaItemId: string) => {
    await offlineFetch(`/api/podcasts/${id}/media?media_item_id=${mediaItemId}`, { method: 'DELETE' });
    load();
  };

  const handleDelete = async () => {
    if (!confirm('Delete this episode?')) return;
    const res = await offlineFetch(`/api/podcasts/${id}`, { method: 'DELETE' });
    if (res.ok) router.push('/dashboard/media/podcasts');
  };

  const handleStatusChange = async (status: string) => {
    await offlineFetch(`/api/podcasts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    load();
  };

  const handleToggleVisibility = async () => {
    if (!episode) return;
    const visibility = episode.visibility === 'public' ? 'private' : 'public';
    await offlineFetch(`/api/podcasts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visibility }),
    });
    load();
  };

  const openEdit = () => {
    if (!episode) return;
    setEditForm({
      title: episode.title,
      episode_number: episode.episode_number != null ? String(episode.episode_number) : '',
      season_number: episode.season_number != null ? String(episode.season_number) : '',
      air_date: episode.air_date ?? '',
      status: episode.status,
      visibility: episode.visibility,
      description: episode.description ?? '',
      show_notes: episode.show_notes ?? '',
    });
    setShowEdit(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingEdit(true);
    try {
      const res = await offlineFetch(`/api/podcasts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editForm.title.trim(),
          episode_number: editForm.episode_number ? parseInt(editForm.episode_number) : null,
          season_number: editForm.season_number ? parseInt(editForm.season_number) : null,
          air_date: editForm.air_date || null,
          status: editForm.status,
          visibility: editForm.visibility,
          description: editForm.description.trim() || null,
          show_notes: editForm.show_notes.trim() || null,
        }),
      });
      if (res.ok) { setShowEdit(false); load(); }
    } finally { setSavingEdit(false); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin h-8 w-8 text-fuchsia-600" />
      </div>
    );
  }

  if (!episode) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10 text-center text-gray-400">
        <p>Episode not found.</p>
        <Link href="/dashboard/media/podcasts" className="text-fuchsia-600 hover:underline mt-2 inline-block">Back</Link>
      </div>
    );
  }

  const badge = STATUS_BADGE[episode.status] ?? STATUS_BADGE.draft;
  const isPublic = episode.visibility === 'public';

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/media/podcasts" className="p-2 rounded-lg hover:bg-gray-100 transition">
          <ArrowLeft className="w-4 h-4 text-gray-600" />
        </Link>
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            {episode.episode_number != null && (
              <span className="text-xs text-gray-400 font-mono">
                {episode.season_number != null ? `S${episode.season_number}E${episode.episode_number}` : `#${episode.episode_number}`}
              </span>
            )}
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.className}`}>{badge.label}</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{episode.title}</h1>
          {episode.air_date && <p className="text-sm text-gray-500">{fmtDate(episode.air_date)}</p>}
        </div>
      </div>

      {/* Details */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
        {episode.description && (
          <div>
            <span className="text-gray-400 text-xs block">Description</span>
            <p className="text-sm text-gray-700">{episode.description}</p>
          </div>
        )}
        {episode.show_notes ? (
          <div>
            <span className="text-gray-400 text-xs block">Show Notes</span>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{episode.show_notes}</p>
          </div>
        ) : (
          <p className="text-xs text-gray-400">No show notes yet — use Edit to add them.</p>
        )}
        {episode.duration_min && (
          <div className="text-sm">
            <span className="text-gray-400 text-xs block">Duration</span>
            <span className="text-gray-900">{episode.duration_min} min</span>
          </div>
        )}
      </div>

      {/* Status + Actions */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4">
        <div className="flex flex-col sm:flex-row flex-wrap gap-2">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
            {['draft', 'recorded', 'published'].map((s) => (
              <button key={s} type="button" onClick={() => handleStatusChange(s)}
                className={`px-3 min-h-11 font-medium transition capitalize ${
                  episode.status === s ? 'bg-fuchsia-600 text-white' : 'text-gray-600 hover:bg-gray-50'
                }`}>
                {s}
              </button>
            ))}
          </div>
          <button onClick={openEdit}
            className="flex items-center gap-1.5 px-3 min-h-11 bg-sky-50 text-sky-600 rounded-lg text-sm font-medium hover:bg-sky-100 transition">
            <Edit3 className="w-3.5 h-3.5" /> Edit
          </button>
          <button onClick={handleToggleVisibility}
            aria-label={isPublic ? 'Make private' : 'Make public'}
            className={`flex items-center gap-1.5 px-3 min-h-11 rounded-lg text-sm font-medium transition ${
              isPublic ? 'bg-fuchsia-50 text-fuchsia-600' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}>
            {isPublic ? <Globe className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
            {isPublic ? 'Public' : 'Private'}
          </button>
          {isPublic && (
            <a href={`/episodes/${episode.id}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 min-h-11 bg-gray-50 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-100 transition">
              <ExternalLink className="w-3.5 h-3.5" /> View public page
            </a>
          )}
          <button onClick={handleDelete}
            className="flex items-center gap-1.5 px-3 min-h-11 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 transition">
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
        </div>
        {isPublic && (
          <p className="mt-2 text-xs text-gray-400">
            This episode&apos;s show notes are visible to anyone at <span className="font-mono">/episodes/{episode.id}</span>.
          </p>
        )}
      </div>

      {/* Linked Media */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-700">Discussed Media ({linkedMedia.length})</h3>

        {/* Search to link, with optional timestamp */}
        <div className="space-y-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search media to link..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
              {searchResults.length > 0 && (
                <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {searchResults.map((r) => (
                    <button key={r.id} type="button"
                      onClick={() => handleLinkMedia(r.id)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 min-h-11">
                      <span>{TYPE_ICONS[r.media_type] ?? '\u{1F4E6}'}</span>
                      <span className="truncate">{r.title}</span>
                      {r.creator && <span className="text-xs text-gray-400 shrink-0">by {r.creator}</span>}
                      <Plus className="w-3.5 h-3.5 text-fuchsia-600 ml-auto shrink-0" />
                    </button>
                  ))}
                </div>
              )}
              {searching && <span className="absolute right-3 top-2.5 text-xs text-gray-400">Searching...</span>}
            </div>
            <input
              type="text"
              value={linkTimestamp}
              onChange={(e) => setLinkTimestamp(e.target.value)}
              placeholder="00:15:30"
              aria-label="Timestamp for the next linked title"
              className="w-28 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono"
            />
          </div>
          <p className="text-[11px] text-gray-400">Set a timestamp, then pick a title to link it at that point.</p>
        </div>

        {/* Linked items */}
        {linkedMedia.length === 0 ? (
          <p className="text-xs text-gray-400">No media linked yet. Search above to add items discussed in this episode.</p>
        ) : (
          <div className="space-y-2">
            {linkedMedia.map((lm) => (
              <div key={lm.id} className="flex items-center gap-3 border border-gray-100 rounded-lg p-3">
                <span className="text-lg">{TYPE_ICONS[lm.media_type] ?? '\u{1F4E6}'}</span>
                <div className="min-w-0 flex-1">
                  <Link href={`/dashboard/media/${lm.media_item_id}`}
                    className="text-sm font-medium text-gray-900 hover:text-fuchsia-600 truncate block">
                    {lm.title}
                  </Link>
                  {lm.creator && <p className="text-xs text-gray-500">{lm.creator}</p>}
                </div>
                {editingLinkId === lm.media_item_id ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={timestampDraft}
                      onChange={(e) => setTimestampDraft(e.target.value)}
                      placeholder="00:15:30"
                      aria-label="Timestamp"
                      className="w-24 border border-gray-200 rounded px-2 py-1 text-xs font-mono"
                      autoFocus
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSaveTimestamp(lm.media_item_id); if (e.key === 'Escape') setEditingLinkId(null); }}
                    />
                    <button onClick={() => handleSaveTimestamp(lm.media_item_id)} aria-label="Save timestamp"
                      className="text-green-600 hover:text-green-700 min-h-8 min-w-8 flex items-center justify-center">
                      <Check className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setEditingLinkId(lm.media_item_id); setTimestampDraft(lm.timestamp_start ?? ''); }}
                    className="text-xs text-gray-400 hover:text-fuchsia-600 font-mono shrink-0"
                    aria-label={`Edit timestamp for ${lm.title}`}
                  >
                    {lm.timestamp_start ? `⏱ ${lm.timestamp_start}` : '+ time'}
                  </button>
                )}
                <button onClick={() => handleUnlinkMedia(lm.media_item_id)}
                  aria-label="Unlink media"
                  className="text-red-400 hover:text-red-600 transition min-h-6 min-w-6 flex items-center justify-center">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit episode modal */}
      <Modal isOpen={showEdit} onClose={() => setShowEdit(false)} title="Edit Episode" size="sm">
        <form onSubmit={handleSaveEdit}>
          <div className="p-6 space-y-4">
            <div>
              <label htmlFor="ee-title" className="block text-xs font-medium text-gray-600 mb-1">Title</label>
              <input id="ee-title" type="text" value={editForm.title} required
                onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="ee-season" className="block text-xs font-medium text-gray-600 mb-1">Season #</label>
                <input id="ee-season" type="number" value={editForm.season_number}
                  onChange={(e) => setEditForm((f) => ({ ...f, season_number: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label htmlFor="ee-number" className="block text-xs font-medium text-gray-600 mb-1">Episode #</label>
                <input id="ee-number" type="number" value={editForm.episode_number}
                  onChange={(e) => setEditForm((f) => ({ ...f, episode_number: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label htmlFor="ee-date" className="block text-xs font-medium text-gray-600 mb-1">Air Date</label>
                <input id="ee-date" type="date" value={editForm.air_date}
                  onChange={(e) => setEditForm((f) => ({ ...f, air_date: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="ee-status" className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                <select id="ee-status" value={editForm.status}
                  onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  <option value="draft">Draft</option>
                  <option value="recorded">Recorded</option>
                  <option value="published">Published</option>
                </select>
              </div>
              <div>
                <label htmlFor="ee-visibility" className="block text-xs font-medium text-gray-600 mb-1">Visibility</label>
                <select id="ee-visibility" value={editForm.visibility}
                  onChange={(e) => setEditForm((f) => ({ ...f, visibility: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  <option value="private">Private</option>
                  <option value="public">Public (show-note page)</option>
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="ee-desc" className="block text-xs font-medium text-gray-600 mb-1">Description</label>
              <textarea id="ee-desc" value={editForm.description} rows={2}
                onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label htmlFor="ee-notes" className="block text-xs font-medium text-gray-600 mb-1">Show Notes</label>
              <textarea id="ee-notes" value={editForm.show_notes} rows={6}
                placeholder="Public show notes — what you covered, links, takeaways..."
                onChange={(e) => setEditForm((f) => ({ ...f, show_notes: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 pt-3 pb-3 flex flex-col sm:flex-row gap-3"
            style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
            <button type="button" onClick={() => setShowEdit(false)}
              className="flex-1 border border-gray-200 rounded-xl min-h-11 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
              Cancel
            </button>
            <button type="submit" disabled={savingEdit}
              className="flex-1 bg-fuchsia-600 text-white rounded-xl min-h-11 text-sm font-medium hover:bg-fuchsia-700 transition disabled:opacity-50">
              {savingEdit ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
