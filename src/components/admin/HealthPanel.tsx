'use client';

import { useEffect, useState } from 'react';

interface Health {
  tmdb: boolean; cloudinary: boolean; mailgun: boolean; inbox: boolean; outbox: boolean;
  outboxFailures: number;
}

const LABELS: [keyof Health, string][] = [
  ['tmdb', 'TMDB (metadata)'],
  ['cloudinary', 'Cloudinary (covers/audio)'],
  ['mailgun', 'Mailgun (magic-link email)'],
  ['inbox', 'Inbox.WitUS'],
  ['outbox', 'Outbox.WitUS'],
];

export default function HealthPanel() {
  const [h, setH] = useState<Health | null>(null);

  useEffect(() => {
    fetch('/api/admin/health').then((r) => (r.ok ? r.json() : null)).then((d) => d && setH(d.health)).catch(() => {});
  }, []);

  return (
    <section className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
      <h2 className="text-sm font-semibold text-gray-700">Integrations</h2>
      {!h ? (
        <p className="text-xs text-gray-400">Loading…</p>
      ) : (
        <div className="space-y-1.5">
          {LABELS.map(([k, label]) => (
            <div key={k} className="flex items-center gap-2 text-sm">
              <span className={`w-2 h-2 rounded-full ${h[k] ? 'bg-green-500' : 'bg-gray-300'}`} />
              <span className="text-gray-700">{label}</span>
              <span className="ml-auto text-xs text-gray-400">{h[k] ? 'configured' : 'not set'}</span>
            </div>
          ))}
          {h.outboxFailures > 0 && (
            <p className="text-xs text-red-600 pt-1">{h.outboxFailures} outbox failure(s) recorded — check the Outbox panel.</p>
          )}
        </div>
      )}
    </section>
  );
}
