'use client';

import { useState } from 'react';

const input = "w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-500";
const label = "block text-xs font-medium text-neutral-400 mb-1";

const MEDIA_TYPES = [
  { value: 'book', label: 'Book' },
  { value: 'movie', label: 'Movie' },
  { value: 'tv_show', label: 'TV show' },
  { value: 'podcast', label: 'Podcast' },
  { value: 'music', label: 'Music' },
  { value: 'other', label: 'Other' },
];

export default function PitchForm() {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus('sending');
    setError('');
    const fd = new FormData(e.currentTarget);
    const res = await fetch('/api/pitch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(fd)),
    });
    if (res.ok) setStatus('sent');
    else { setStatus('error'); setError((await res.json().catch(() => ({}))).error || 'Something went wrong.'); }
  };

  if (status === 'sent') {
    return (
      <div className="rounded-xl border border-neutral-700 bg-neutral-900 p-4 text-sm text-neutral-300">
        Thanks for the pitch — we&apos;ll take a look.
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input type="text" name="company" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <div>
        <label htmlFor="p-name" className={label}>Name</label>
        <input id="p-name" name="name" required className={input} />
      </div>
      <div>
        <label htmlFor="p-email" className={label}>Email</label>
        <input id="p-email" name="email" type="email" required className={input} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="p-type" className={label}>Media type</label>
          <select id="p-type" name="media_type" className={input}>
            {MEDIA_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="p-title" className={label}>Title</label>
          <input id="p-title" name="title" required className={input} />
        </div>
      </div>
      <div>
        <label htmlFor="p-link" className={label}>Link (optional)</label>
        <input id="p-link" name="link" type="url" placeholder="https://…" className={input} />
      </div>
      <div>
        <label htmlFor="p-pitch" className={label}>Your pitch</label>
        <textarea id="p-pitch" name="pitch" rows={4} required className={input} />
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button type="submit" disabled={status === 'sending'}
        className="w-full rounded-lg bg-fuchsia-600 py-2 text-sm font-medium text-white transition hover:bg-fuchsia-700 disabled:opacity-50">
        {status === 'sending' ? 'Sending…' : 'Send pitch'}
      </button>
    </form>
  );
}
