'use client';

import { useEffect, useState, useCallback } from 'react';
import { Loader2 } from 'lucide-react';

interface Flags { master: boolean; triggers: Record<string, boolean> }
interface LogRow { id: string; source: string; platform: string; externalRef: string; httpStatus: number | null; ok: boolean; createdAt: string }

const TRIGGER_LABEL: Record<string, string> = {
  finished_media: 'Finished media (any type)',
  episode_published: 'Episode published',
  club_read: 'Club starts a read',
};

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-700">{label}</span>
      <button onClick={onClick} role="switch" aria-checked={on} aria-label={label}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? 'bg-fuchsia-600' : 'bg-gray-300'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${on ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </div>
  );
}

export default function OutboxPanel() {
  const [flags, setFlags] = useState<Flags | null>(null);
  const [log, setLog] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/admin/outbox');
    if (res.ok) { const d = await res.json(); setFlags(d.flags); setLog(d.log || []); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const setFlag = async (key: string, value: boolean) => {
    // optimistic
    setFlags((f) => f && (key === 'outbox_enabled'
      ? { ...f, master: value }
      : { ...f, triggers: { ...f.triggers, [key.replace('outbox_trigger_', '')]: value } }));
    await fetch('/api/admin/outbox', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value }),
    });
  };

  if (loading || !flags) return <div className="py-8 flex justify-center"><Loader2 className="animate-spin h-5 w-5 text-fuchsia-600" /></div>;

  return (
    <section className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-gray-700">Outbox</h2>
        <p className="text-xs text-gray-500 mt-0.5">Master switch + per-trigger control for social drafts.</p>
      </div>

      <Toggle on={flags.master} onClick={() => setFlag('outbox_enabled', !flags.master)} label="Outbox enabled (master)" />

      <div className={`space-y-2 border-t border-gray-100 pt-3 ${flags.master ? '' : 'opacity-50 pointer-events-none'}`}>
        {Object.entries(flags.triggers).map(([k, v]) => (
          <Toggle key={k} on={v} label={TRIGGER_LABEL[k] ?? k} onClick={() => setFlag(`outbox_trigger_${k}`, !v)} />
        ))}
      </div>

      <div className="border-t border-gray-100 pt-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Recent activity</p>
        {log.length === 0 ? (
          <p className="text-xs text-gray-400">No outbox attempts recorded yet.</p>
        ) : (
          <ul className="space-y-1 max-h-56 overflow-y-auto">
            {log.map((r) => (
              <li key={r.id} className="flex items-center gap-2 text-xs">
                <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${r.ok ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-gray-500 shrink-0">{r.platform}</span>
                <span className="text-gray-700 truncate flex-1 font-mono">{r.externalRef}</span>
                <span className="text-gray-400 shrink-0">{r.httpStatus ?? '—'}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
