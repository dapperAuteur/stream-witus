'use client';

import { useState } from 'react';

const input = "w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-500";
const label = "block text-xs font-medium text-neutral-400 mb-1";

export default function ContactForm() {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus('sending');
    setError('');
    const fd = new FormData(e.currentTarget);
    const res = await fetch('/api/contact', {
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
        Thanks — we got it. We&apos;ll be in touch about getting you on the show.
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {/* Honeypot — hidden from real users */}
      <input type="text" name="company" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <div>
        <label htmlFor="c-name" className={label}>Name</label>
        <input id="c-name" name="name" required className={input} />
      </div>
      <div>
        <label htmlFor="c-email" className={label}>Email</label>
        <input id="c-email" name="email" type="email" required className={input} />
      </div>
      <div>
        <label htmlFor="c-role" className={label}>I&apos;m interested in being a…</label>
        <select id="c-role" name="role" className={input}>
          <option value="guest">Guest</option>
          <option value="co-host">Co-host</option>
        </select>
      </div>
      <div>
        <label htmlFor="c-topic" className={label}>What would you talk about?</label>
        <textarea id="c-topic" name="topic" rows={3} required className={input} />
      </div>
      <div>
        <label htmlFor="c-link" className={label}>A link (optional)</label>
        <input id="c-link" name="link" type="url" placeholder="https://…" className={input} />
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button type="submit" disabled={status === 'sending'}
        className="w-full rounded-lg bg-fuchsia-600 py-2 text-sm font-medium text-white transition hover:bg-fuchsia-700 disabled:opacity-50">
        {status === 'sending' ? 'Sending…' : 'Send'}
      </button>
    </form>
  );
}
