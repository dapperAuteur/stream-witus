'use client';

import { useEffect, useState, useCallback } from 'react';
import { Loader2, Check, Archive } from 'lucide-react';

interface Submission {
  id: string; formType: string; name: string | null; email: string | null;
  payload: Record<string, unknown> | null; status: string; createdAt: string;
}

const FORM_LABEL: Record<string, string> = {
  'be-on-show': 'Guest / co-host', 'pitch-media': 'Media pitch', waitlist: 'Waitlist',
};

export default function InboxPanel() {
  const [subs, setSubs] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/admin/inbox');
    if (res.ok) setSubs((await res.json()).submissions || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const setStatus = async (id: string, status: 'read' | 'archived' | 'new') => {
    setSubs((s) => s.map((x) => (x.id === id ? { ...x, status } : x)));
    await fetch('/api/admin/inbox', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
  };

  const visible = subs.filter((s) => (showArchived ? true : s.status !== 'archived'));
  const newCount = subs.filter((s) => s.status === 'new').length;

  return (
    <section className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-700">Inbox {newCount > 0 && <span className="ml-1 text-[10px] bg-fuchsia-600 text-white rounded-full px-1.5 py-0.5">{newCount} new</span>}</h2>
          <p className="text-xs text-gray-500 mt-0.5">Guest/co-host, media pitches, and waitlist joins.</p>
        </div>
        <label className="flex items-center gap-1.5 text-xs text-gray-500">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)}
            className="rounded border-gray-300 text-fuchsia-600 focus:ring-fuchsia-500" />
          Show archived
        </label>
      </div>

      {loading ? (
        <div className="py-6 flex justify-center"><Loader2 className="animate-spin h-5 w-5 text-fuchsia-600" /></div>
      ) : visible.length === 0 ? (
        <p className="text-xs text-gray-400">Nothing here yet.</p>
      ) : (
        <ul className="space-y-2">
          {visible.map((s) => (
            <li key={s.id} className={`rounded-lg border p-3 ${s.status === 'new' ? 'border-fuchsia-200 bg-fuchsia-50/40' : 'border-gray-100'}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{FORM_LABEL[s.formType] ?? s.formType}</span>
                <span className="text-sm font-medium text-gray-800 truncate">{s.name || s.email || '—'}</span>
                {s.email && s.name && <span className="text-xs text-gray-400 truncate">{s.email}</span>}
                <div className="ml-auto flex items-center gap-1 shrink-0">
                  {s.status !== 'read' && s.status !== 'archived' && (
                    <button onClick={() => setStatus(s.id, 'read')} aria-label="Mark read" className="text-gray-400 hover:text-green-600 p-1"><Check className="w-3.5 h-3.5" /></button>
                  )}
                  {s.status !== 'archived' && (
                    <button onClick={() => setStatus(s.id, 'archived')} aria-label="Archive" className="text-gray-400 hover:text-gray-700 p-1"><Archive className="w-3.5 h-3.5" /></button>
                  )}
                </div>
              </div>
              {s.payload && (
                <dl className="text-xs text-gray-600 space-y-0.5">
                  {Object.entries(s.payload).filter(([, v]) => v != null && v !== '').map(([k, v]) => (
                    <div key={k} className="flex gap-1.5">
                      <dt className="text-gray-400 shrink-0">{k}:</dt>
                      <dd className="truncate">{String(v)}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
