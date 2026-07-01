'use client';

import { useEffect, useState } from 'react';

interface Def { key: string; label: string; fallback: boolean }

export default function FlagsPanel() {
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [defs, setDefs] = useState<Def[]>([]);

  useEffect(() => {
    fetch('/api/admin/flags').then((r) => (r.ok ? r.json() : null)).then((d) => { if (d) { setFlags(d.flags); setDefs(d.defs); } }).catch(() => {});
  }, []);

  const toggle = async (key: string) => {
    const value = !flags[key];
    setFlags((f) => ({ ...f, [key]: value }));
    await fetch('/api/admin/flags', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value }),
    });
  };

  return (
    <section className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
      <h2 className="text-sm font-semibold text-gray-700">Feature flags</h2>
      {defs.length === 0 ? (
        <p className="text-xs text-gray-400">Loading…</p>
      ) : (
        <div className="space-y-2">
          {defs.map((d) => {
            const on = flags[d.key];
            return (
              <div key={d.key} className="flex items-center justify-between">
                <span className="text-sm text-gray-700">{d.label}</span>
                <button onClick={() => toggle(d.key)} role="switch" aria-checked={on} aria-label={d.label}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? 'bg-fuchsia-600' : 'bg-gray-300'}`}>
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${on ? 'left-[22px]' : 'left-0.5'}`} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
