'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface Entry {
  id: string; actorEmail: string | null; action: string;
  targetType: string | null; targetId: string | null;
  meta: Record<string, unknown> | null; createdAt: string;
}

function fmt(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export default function AuditPanel() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/audit')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setEntries(d.entries || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-gray-700">Audit log</h2>
        <p className="text-xs text-gray-500 mt-0.5">Every admin action, most recent first.</p>
      </div>
      {loading ? (
        <div className="py-6 flex justify-center"><Loader2 className="animate-spin h-5 w-5 text-fuchsia-600" /></div>
      ) : entries.length === 0 ? (
        <p className="text-xs text-gray-400">No admin actions recorded yet.</p>
      ) : (
        <ul className="space-y-1 max-h-72 overflow-y-auto">
          {entries.map((e) => {
            const target = [e.targetType, e.targetId].filter(Boolean).join(':');
            const meta = e.meta ? Object.entries(e.meta).map(([k, v]) => `${k}=${String(v)}`).join(' ') : '';
            return (
              <li key={e.id} className="flex items-baseline gap-2 text-xs">
                <span className="text-gray-400 shrink-0 tabular-nums w-24">{fmt(e.createdAt)}</span>
                <span className="font-mono text-fuchsia-700 shrink-0">{e.action}</span>
                <span className="text-gray-600 truncate flex-1">
                  {target}
                  {meta && <span className="text-gray-400"> · {meta}</span>}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
