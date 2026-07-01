'use client';

import { useEffect, useState } from 'react';

interface Stats {
  mediaTotal: number; mediaInProgress: number; mediaCompleted: number; mediaPublic: number;
  episodes: number; episodesPublished: number; clubs: number; waitlistWaiting: number; inboxNew: number;
}

export default function StatsPanel() {
  const [s, setS] = useState<Stats | null>(null);

  useEffect(() => {
    fetch('/api/admin/stats').then((r) => (r.ok ? r.json() : null)).then((d) => d && setS(d.stats)).catch(() => {});
  }, []);

  const cards: { label: string; value: number | string }[] = s
    ? [
        { label: 'Media', value: s.mediaTotal },
        { label: 'In progress', value: s.mediaInProgress },
        { label: 'Completed', value: s.mediaCompleted },
        { label: 'Public', value: s.mediaPublic },
        { label: 'Episodes', value: `${s.episodesPublished}/${s.episodes}` },
        { label: 'Clubs', value: s.clubs },
        { label: 'Waitlist', value: s.waitlistWaiting },
        { label: 'Inbox new', value: s.inboxNew },
      ]
    : Array.from({ length: 8 }, (_, i) => ({ label: '', value: i }));

  return (
    <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {cards.map((c, i) => (
        <div key={c.label || i} className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-xl font-bold text-gray-900">{s ? c.value : '—'}</div>
          <div className="text-xs text-gray-500 mt-0.5">{c.label || '…'}</div>
        </div>
      ))}
    </section>
  );
}
