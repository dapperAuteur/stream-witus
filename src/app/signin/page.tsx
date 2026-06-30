'use client';

import { useState } from 'react';
import { signIn } from '@/lib/auth-client';

export default function SignInPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus('sending');
    setError('');
    const { error: err } = await signIn.magicLink({
      email: email.trim(),
      callbackURL: '/dashboard/media',
    });
    if (err) {
      setStatus('error');
      setError(err.message ?? 'Could not send the magic link. Try again.');
    } else {
      setStatus('sent');
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-bold">Stream.WitUS</h1>
          <p className="text-sm text-neutral-400">Sign in with a magic link.</p>
        </div>

        {status === 'sent' ? (
          <div className="rounded-xl border border-neutral-700 bg-neutral-900 p-4 text-center text-sm text-neutral-300">
            Check <span className="font-medium text-white">{email}</span> for your sign-in link.
            It expires in 10 minutes.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <label htmlFor="email" className="block text-xs font-medium text-neutral-400">
              Email
            </label>
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
              disabled={status === 'sending'}
              className="w-full rounded-lg bg-fuchsia-600 py-2 text-sm font-medium text-white transition hover:bg-fuchsia-700 disabled:opacity-50"
            >
              {status === 'sending' ? 'Sending…' : 'Send magic link'}
            </button>
            {error && <p className="text-sm text-red-400" role="alert">{error}</p>}
          </form>
        )}
      </div>
    </main>
  );
}
