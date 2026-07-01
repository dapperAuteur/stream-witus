'use client';

import { useEffect, useState, useCallback } from 'react';
import { Loader2 } from 'lucide-react';

interface Member {
  id: string; email: string; name: string | null;
  adminRole: 'none' | 'monitor' | 'moderator' | 'admin';
  deactivated: boolean; isOwner: boolean;
}

const ROLES = ['none', 'monitor', 'moderator', 'admin'] as const;

export default function MembersPanel() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/admin/members');
    if (res.ok) setMembers((await res.json()).users || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const patch = async (id: string, payload: Record<string, unknown>) => {
    const res = await fetch('/api/admin/members', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...payload }),
    });
    if (res.ok) load();
  };

  return (
    <section className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-gray-700">Members &amp; roles</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          owner &gt; admin (all but user mgmt) &gt; moderator (content) &gt; monitor (read-only). Owner-only.
        </p>
      </div>
      {loading ? (
        <div className="py-6 flex justify-center"><Loader2 className="animate-spin h-5 w-5 text-fuchsia-600" /></div>
      ) : members.length === 0 ? (
        <p className="text-xs text-gray-400">No users yet.</p>
      ) : (
        <ul className="divide-y divide-gray-50">
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-2 py-2">
              <div className="min-w-0 flex-1">
                <p className={`text-sm truncate ${m.deactivated ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                  {m.name || m.email}
                  {m.isOwner && <span className="ml-1.5 text-[10px] bg-fuchsia-600 text-white rounded px-1.5 py-0.5">owner</span>}
                </p>
                {m.name && <p className="text-xs text-gray-400 truncate">{m.email}</p>}
              </div>
              {m.isOwner ? (
                <span className="text-xs text-gray-400 shrink-0">full access</span>
              ) : (
                <>
                  <select value={m.adminRole} onChange={(e) => patch(m.id, { role: e.target.value })}
                    className="border border-gray-200 rounded-lg px-2 py-1 text-xs" aria-label={`Role for ${m.email}`}>
                    {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <button onClick={() => patch(m.id, { deactivated: !m.deactivated })}
                    className={`px-2 py-1 rounded text-xs font-medium shrink-0 ${m.deactivated ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}>
                    {m.deactivated ? 'Reactivate' : 'Deactivate'}
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
