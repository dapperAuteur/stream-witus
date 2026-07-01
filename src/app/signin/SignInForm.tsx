'use client';

import { useState } from 'react';
import { signIn } from '@/lib/auth-client';
import { WitusSsoButton } from '@/components/witus-sso-button';

type Status = 'idle' | 'checking' | 'sent' | 'waitlisted' | 'error';

export function SignInForm({ witusSsoEnabled }: { witusSsoEnabled: boolean }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const addr = email.trim();
    if (!addr) return;
    setStatus('checking');
    setError('');
    try {
      // 1) Is this email allowed to sign in, or does it go to the waitlist?
      const statusRes = await fetch('/api/access/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: addr }),
      });
      const { allowed } = await statusRes.json();

      if (allowed) {
        const { error: err } = await signIn.magicLink({ email: addr, callbackURL: '/dashboard/media' });
        if (err) {
          setStatus('error');
          setError(err.message ?? 'Could not send the magic link. Try again.');
        } else {
          setStatus('sent');
        }
      } else {
        // 2) Not allowed → join the waitlist.
        await fetch('/api/access/waitlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: addr }),
        });
        setStatus('waitlisted');
      }
    } catch {
      setStatus('error');
      setError('Something went wrong. Try again.');
    }
  };

  if (status === 'sent') {
    return (
      <div className="rounded-xl border border-neutral-700 bg-neutral-900 p-4 text-center text-sm text-neutral-300">
        Check <span className="font-medium text-white">{email}</span> for your sign-in link.
        It expires in 10 minutes.
      </div>
    );
  }

  if (status === 'waitlisted') {
    return (
      <div className="rounded-xl border border-neutral-700 bg-neutral-900 p-4 text-center text-sm text-neutral-300">
        Stream.WitUS is invite-only right now. We&apos;ve added{' '}
        <span className="font-medium text-white">{email}</span> to the waitlist and will email you
        when it opens.
      </div>
    );
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-3">
        <label htmlFor="email" className="block text-xs font-medium text-neutral-400">Email</label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-500"
        />
        <button
          type="submit"
          disabled={status === 'checking'}
          className="w-full rounded-lg bg-fuchsia-600 py-2 text-sm font-medium text-white transition hover:bg-fuchsia-700 disabled:opacity-50"
        >
          {status === 'checking' ? 'Checking…' : 'Continue'}
        </button>
        {error && <p className="text-sm text-red-400" role="alert">{error}</p>}
      </form>

      {witusSsoEnabled ? (
        <div className="space-y-3">
          <p className="text-center text-xs uppercase tracking-wide text-neutral-500">or</p>
          <WitusSsoButton />
        </div>
      ) : null}
    </>
  );
}
