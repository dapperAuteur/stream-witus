'use client';

import { useEffect, useState, useCallback } from 'react';
import { Loader2, Check, Copy } from 'lucide-react';

interface WaitlistEntry {
  email: string;
  status: 'waiting' | 'approved';
  note: string | null;
  createdAt: string;
}

export default function AdminPanel({ ownerId }: { ownerId: string }) {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [signupsOpen, setSignupsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [wRes, sRes] = await Promise.all([
      fetch('/api/admin/waitlist'),
      fetch('/api/admin/settings'),
    ]);
    if (wRes.ok) setEntries((await wRes.json()).entries || []);
    if (sRes.ok) setSignupsOpen((await sRes.json()).signupsOpen);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleSignups = async () => {
    const next = !signupsOpen;
    setSignupsOpen(next);
    await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signupsOpen: next }),
    });
  };

  const setStatus = async (email: string, status: 'approved' | 'waiting') => {
    const res = await fetch('/api/admin/waitlist', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, status }),
    });
    if (res.ok) load();
  };

  const copyOwnerId = async () => {
    try { await navigator.clipboard.writeText(ownerId); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  };

  const waiting = entries.filter((e) => e.status === 'waiting');
  const approved = entries.filter((e) => e.status === 'approved');

  return (
    <div className="space-y-6">
      {/* Your user id — for PRODUCT_OWNER_USER_ID */}
      <section className="bg-white border border-gray-200 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-gray-700">Your user id</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Owner is identified by email, so the outbox already treats you as owner. If you want to set
          <span className="font-mono"> PRODUCT_OWNER_USER_ID</span> explicitly, this is the value:
        </p>
        <div className="mt-2 flex items-center gap-2">
          <code className="flex-1 truncate rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-xs">{ownerId}</code>
          <button onClick={copyOwnerId}
            className="flex items-center gap-1.5 px-3 min-h-9 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200">
            {copied ? <><Check className="w-3.5 h-3.5" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
          </button>
        </div>
      </section>

      {/* Signups toggle */}
      <section className="bg-white border border-gray-200 rounded-2xl p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-700">Open signups</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {signupsOpen
                ? 'Anyone can sign up right now.'
                : 'Invite-only — only you and approved emails can sign in; everyone else joins the waitlist.'}
            </p>
          </div>
          <button onClick={toggleSignups} role="switch" aria-checked={signupsOpen}
            className={`relative h-6 w-11 shrink-0 rounded-full transition ${signupsOpen ? 'bg-fuchsia-600' : 'bg-gray-300'}`}>
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${signupsOpen ? 'left-[22px]' : 'left-0.5'}`} />
          </button>
        </div>
      </section>

      {/* Waitlist */}
      <section className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">Waitlist</h2>
        {loading ? (
          <div className="py-6 flex justify-center"><Loader2 className="animate-spin h-5 w-5 text-fuchsia-600" /></div>
        ) : (
          <>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Waiting ({waiting.length})</p>
              {waiting.length === 0 ? (
                <p className="text-xs text-gray-400">Nobody waiting.</p>
              ) : (
                <ul className="divide-y divide-gray-50">
                  {waiting.map((e) => (
                    <li key={e.email} className="flex items-center gap-2 py-2">
                      <span className="flex-1 truncate text-sm text-gray-700">{e.email}</span>
                      <button onClick={() => setStatus(e.email, 'approved')}
                        className="px-2.5 py-1 bg-fuchsia-600 text-white rounded-lg text-xs font-medium hover:bg-fuchsia-700">Approve</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {approved.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Approved ({approved.length})</p>
                <ul className="divide-y divide-gray-50">
                  {approved.map((e) => (
                    <li key={e.email} className="flex items-center gap-2 py-2">
                      <span className="flex-1 truncate text-sm text-gray-700">{e.email}</span>
                      <button onClick={() => setStatus(e.email, 'waiting')}
                        className="px-2.5 py-1 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200">Revoke</button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
