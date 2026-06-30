'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Plus, Loader2, Users, Globe, Lock } from 'lucide-react';

interface Club {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  visibility: string;
  role: string;
}

export default function ClubsPage() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState('private');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/clubs');
      if (res.ok) setClubs((await res.json()).clubs || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/clubs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || null, visibility }),
      });
      if (res.ok) {
        setName(''); setDescription(''); setVisibility('private'); setShowForm(false);
        load();
      } else {
        setError((await res.json()).error || 'Could not create club');
      }
    } finally { setSaving(false); }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ReadWitUS Clubs</h1>
          <p className="text-sm text-gray-500 mt-0.5">Spoiler-safe book clubs — discussion gated by reading progress.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-4 py-2 bg-fuchsia-600 text-white rounded-xl text-sm font-medium hover:bg-fuchsia-700 transition min-h-11">
          <Plus className="w-4 h-4" /> New Club
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
          <div>
            <label htmlFor="club-name" className="block text-xs font-medium text-gray-600 mb-1">Name</label>
            <input id="club-name" type="text" value={name} required
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label htmlFor="club-desc" className="block text-xs font-medium text-gray-600 mb-1">Description</label>
            <textarea id="club-desc" value={description} rows={2}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label htmlFor="club-vis" className="block text-xs font-medium text-gray-600 mb-1">Visibility</label>
            <select id="club-vis" value={visibility} onChange={(e) => setVisibility(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
              <option value="private">Private</option>
              <option value="public">Public (a public club page)</option>
            </select>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowForm(false)}
              className="flex-1 border border-gray-200 rounded-xl min-h-11 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving}
              className="flex-1 bg-fuchsia-600 text-white rounded-xl min-h-11 text-sm font-medium hover:bg-fuchsia-700 disabled:opacity-50">
              {saving ? 'Creating...' : 'Create Club'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="py-16 flex justify-center"><Loader2 className="animate-spin h-6 w-6 text-fuchsia-600" /></div>
      ) : clubs.length === 0 ? (
        <p className="py-16 text-center text-sm text-gray-400">No clubs yet. Create one to start a read.</p>
      ) : (
        <div className="space-y-2">
          {clubs.map((c) => (
            <Link key={c.id} href={`/dashboard/clubs/${c.id}`}
              className="block bg-white border border-gray-200 rounded-xl p-4 hover:border-fuchsia-300 hover:shadow-sm transition">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-gray-900 truncate">{c.name}</h2>
                  {c.description && <p className="text-xs text-gray-500 truncate mt-0.5">{c.description}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0 text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    {c.visibility === 'public' ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                  </span>
                  <span className="flex items-center gap-1 capitalize"><Users className="w-3 h-3" /> {c.role}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
