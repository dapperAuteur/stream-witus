'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import { Search, Loader2 } from 'lucide-react';
import type { MediaPrefill } from '@/components/media/MediaForm';

interface MetadataResult {
  source: 'openlibrary' | 'tmdb';
  externalId: string;
  title: string;
  creator: string | null;
  yearReleased: number | null;
  coverImageUrl: string | null;
  synopsis: string | null;
  mediaType: 'book' | 'movie' | 'tv_show';
}

const TYPE_TABS = [
  { value: '', label: 'All' },
  { value: 'book', label: '\u{1F4D6} Books' },
  { value: 'movie', label: '\u{1F3AC} Movies' },
  { value: 'tv_show', label: '\u{1F4FA} TV' },
];

const SOURCE_LABEL: Record<string, string> = {
  openlibrary: 'Open Library',
  tmdb: 'TMDB',
};

interface MetadataSearchDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onPicked: (prefill: MediaPrefill) => void;
}

export default function MetadataSearchDialog({ isOpen, onClose, onPicked }: MetadataSearchDialogProps) {
  const [query, setQuery] = useState('');
  const [type, setType] = useState('');
  const [results, setResults] = useState<MetadataResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');

  const runSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    setSearched(true);
    try {
      const params = new URLSearchParams({ q: query.trim() });
      if (type) params.set('type', type);
      const res = await fetch(`/api/media/lookup?${params}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Lookup failed');
        setResults([]);
        return;
      }
      setResults(data.results || []);
    } catch {
      setError('Network error — try again');
    } finally {
      setLoading(false);
    }
  };

  const pick = (r: MetadataResult) => {
    onPicked({
      title: r.title,
      media_type: r.mediaType,
      creator: r.creator,
      year_released: r.yearReleased,
      cover_image_url: r.coverImageUrl,
      notes: r.synopsis,
      external_source: r.source,
      external_id: r.externalId,
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Search metadata">
      <div className="p-6 space-y-4">
        <p className="text-sm text-gray-500">
          Look up a title in Open Library (books) or TMDB (movies &amp; TV) to auto-fill the details.
        </p>

        <div className="flex flex-wrap gap-1.5">
          {TYPE_TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setType(t.value)}
              className={`px-2.5 py-1.5 rounded-full text-xs font-medium transition ${
                type === t.value
                  ? 'bg-fuchsia-600 text-white'
                  : 'bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runSearch()}
            placeholder="Title, author, show..."
            className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-fuchsia-500 focus:border-transparent outline-none min-h-11"
            autoFocus
          />
          <button
            type="button"
            onClick={runSearch}
            disabled={loading || !query.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-fuchsia-600 hover:bg-fuchsia-700 disabled:opacity-50 rounded-xl transition flex items-center gap-1.5 min-h-11"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" aria-hidden="true" />}
            Search
          </button>
        </div>

        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

        {!loading && searched && results.length === 0 && !error && (
          <p className="text-sm text-gray-400">
            No matches. Try a different title or type — and note TMDB results need its API key configured.
          </p>
        )}

        {results.length > 0 && (
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-100 border border-gray-100 rounded-lg" role="list">
            {results.map((r) => (
              <button
                key={`${r.source}-${r.externalId}`}
                type="button"
                onClick={() => pick(r)}
                className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50 transition"
                role="listitem"
              >
                {r.coverImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.coverImageUrl} alt="" className="w-9 h-12 object-cover rounded bg-gray-100 shrink-0" />
                ) : (
                  <div className="w-9 h-12 rounded bg-gray-100 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">{r.title}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {[r.creator, r.yearReleased].filter(Boolean).join(' · ') || '—'}
                  </p>
                </div>
                <span className="text-[10px] text-gray-400 shrink-0">{SOURCE_LABEL[r.source]}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
