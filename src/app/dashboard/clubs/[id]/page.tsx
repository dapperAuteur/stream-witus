'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Loader2, Lock, Globe, ExternalLink } from 'lucide-react';

interface Club { id: string; name: string; slug: string; description: string | null; visibility: string }
interface Member { userId: string; role: string; email: string; name: string | null }
interface Read { id: string; title: string | null; status: string }
interface Milestone { id: string; label: string; sortOrder: number }
interface Progress { currentMilestoneId: string | null }
interface Post {
  id: string; milestoneId: string | null; milestoneLabel: string | null;
  isSpoiler: boolean; authorName: string | null; createdAt: string;
  locked: boolean; body: string | null; isMine: boolean;
}

const canManage = (role: string | null) => role === 'owner' || role === 'moderator';

export default function ClubDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [club, setClub] = useState<Club | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [reads, setReads] = useState<Read[]>([]);
  const [loading, setLoading] = useState(true);

  const [memberEmail, setMemberEmail] = useState('');
  const [memberError, setMemberError] = useState('');
  const [newReadTitle, setNewReadTitle] = useState('');

  const [selectedRead, setSelectedRead] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<Milestone[]>([]);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [newMilestone, setNewMilestone] = useState('');
  const [postBody, setPostBody] = useState('');
  const [postMilestone, setPostMilestone] = useState('');
  const [postSpoiler, setPostSpoiler] = useState(false);

  const loadClub = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/clubs/${id}`);
      if (res.ok) {
        const d = await res.json();
        setClub(d.club); setRole(d.role);
      }
      const [mRes, rRes] = await Promise.all([
        fetch(`/api/clubs/${id}/members`),
        fetch(`/api/clubs/${id}/reads`),
      ]);
      if (mRes.ok) setMembers((await mRes.json()).members || []);
      if (rRes.ok) {
        const reads = (await rRes.json()).reads || [];
        setReads(reads);
        if (reads.length > 0 && !selectedRead) setSelectedRead(reads[0].id);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => { loadClub(); }, [loadClub]);

  const loadRead = useCallback(async (readId: string) => {
    const [sRes, pRes, dRes] = await Promise.all([
      fetch(`/api/clubs/${id}/reads/${readId}/schedule`),
      fetch(`/api/clubs/${id}/reads/${readId}/progress`),
      fetch(`/api/clubs/${id}/reads/${readId}/discussion`),
    ]);
    if (sRes.ok) setSchedule((await sRes.json()).schedule || []);
    if (pRes.ok) setProgress((await pRes.json()).progress);
    if (dRes.ok) setPosts((await dRes.json()).posts || []);
  }, [id]);

  useEffect(() => { if (selectedRead) loadRead(selectedRead); }, [selectedRead, loadRead]);

  const addMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberEmail.trim()) return;
    setMemberError('');
    const res = await fetch(`/api/clubs/${id}/members`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: memberEmail.trim() }),
    });
    if (res.ok) { setMemberEmail(''); loadClub(); }
    else setMemberError((await res.json()).error || 'Could not add member');
  };

  const addRead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReadTitle.trim()) return;
    const res = await fetch(`/api/clubs/${id}/reads`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newReadTitle.trim(), status: 'active' }),
    });
    if (res.ok) { setNewReadTitle(''); const d = await res.json(); await loadClub(); setSelectedRead(d.read.id); }
  };

  const addMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMilestone.trim() || !selectedRead) return;
    const res = await fetch(`/api/clubs/${id}/reads/${selectedRead}/schedule`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: newMilestone.trim(), sort_order: schedule.length }),
    });
    if (res.ok) { setNewMilestone(''); loadRead(selectedRead); }
  };

  const setMyProgress = async (milestoneId: string) => {
    if (!selectedRead) return;
    const res = await fetch(`/api/clubs/${id}/reads/${selectedRead}/progress`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ milestone_id: milestoneId || null }),
    });
    if (res.ok) loadRead(selectedRead);
  };

  const submitPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postBody.trim() || !selectedRead) return;
    const res = await fetch(`/api/clubs/${id}/reads/${selectedRead}/discussion`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: postBody.trim(), milestone_id: postMilestone || null, is_spoiler: postSpoiler }),
    });
    if (res.ok) { setPostBody(''); setPostMilestone(''); setPostSpoiler(false); loadRead(selectedRead); }
  };

  if (loading) return <div className="py-16 flex justify-center"><Loader2 className="animate-spin h-6 w-6 text-fuchsia-600" /></div>;
  if (!club) return (
    <div className="text-center py-16 text-gray-400">
      <p>Club not found.</p>
      <Link href="/dashboard/clubs" className="text-fuchsia-600 hover:underline mt-2 inline-block">Back to clubs</Link>
    </div>
  );

  const manage = canManage(role);
  const myMilestoneId = progress?.currentMilestoneId ?? '';

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/clubs" className="p-2 rounded-lg hover:bg-gray-100 transition">
          <ArrowLeft className="w-4 h-4 text-gray-600" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">{club.name}</h1>
            <span className="text-xs text-gray-400 flex items-center gap-1">
              {club.visibility === 'public' ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
              {club.visibility}
            </span>
          </div>
          {club.description && <p className="text-sm text-gray-500">{club.description}</p>}
        </div>
        {club.visibility === 'public' && (
          <a href={`/clubs/${club.slug}`} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 min-h-9 bg-gray-50 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-100 transition">
            <ExternalLink className="w-3.5 h-3.5" /> Public page
          </a>
        )}
      </div>

      {/* Members */}
      <section className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Members ({members.length})</h2>
        <div className="flex flex-wrap gap-1.5">
          {members.map((m) => (
            <span key={m.userId} className="text-xs bg-gray-50 border border-gray-200 rounded-full px-2.5 py-1 text-gray-600">
              {m.name ?? m.email} · <span className="capitalize text-gray-400">{m.role}</span>
            </span>
          ))}
        </div>
        {manage && (
          <form onSubmit={addMember} className="flex gap-2">
            <input type="email" value={memberEmail} onChange={(e) => setMemberEmail(e.target.value)}
              placeholder="member@email.com (must have signed in once)"
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            <button type="submit" className="px-3 bg-fuchsia-600 text-white rounded-lg text-sm font-medium hover:bg-fuchsia-700 min-h-11">Add</button>
          </form>
        )}
        {memberError && <p className="text-xs text-red-600">{memberError}</p>}
      </section>

      {/* Reads */}
      <section className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Reads</h2>
        <div className="flex flex-wrap gap-1.5">
          {reads.map((r) => (
            <button key={r.id} onClick={() => setSelectedRead(r.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                selectedRead === r.id ? 'bg-fuchsia-600 text-white' : 'bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100'
              }`}>
              {r.title ?? 'Untitled'}
            </button>
          ))}
        </div>
        {manage && (
          <form onSubmit={addRead} className="flex gap-2">
            <input type="text" value={newReadTitle} onChange={(e) => setNewReadTitle(e.target.value)}
              placeholder="Add a book/title the club is reading..."
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            <button type="submit" className="px-3 bg-fuchsia-600 text-white rounded-lg text-sm font-medium hover:bg-fuchsia-700 min-h-11 flex items-center gap-1"><Plus className="w-4 h-4" /></button>
          </form>
        )}
      </section>

      {selectedRead && (
        <>
          {/* Schedule + my progress */}
          <section className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
            <h2 className="text-sm font-semibold text-gray-700">Schedule &amp; your progress</h2>
            {schedule.length === 0 ? (
              <p className="text-xs text-gray-400">No milestones yet{manage ? ' — add the first below.' : '.'}</p>
            ) : (
              <div className="space-y-1.5">
                {schedule.map((m) => (
                  <label key={m.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="radio" name="progress" checked={myMilestoneId === m.id}
                      onChange={() => setMyProgress(m.id)}
                      className="text-fuchsia-600 focus:ring-fuchsia-500" />
                    <span className="text-gray-700">{m.label}</span>
                  </label>
                ))}
                <button onClick={() => setMyProgress('')} className="text-xs text-gray-400 hover:text-gray-600 mt-1">Reset my progress</button>
              </div>
            )}
            {manage && (
              <form onSubmit={addMilestone} className="flex gap-2 pt-1">
                <input type="text" value={newMilestone} onChange={(e) => setNewMilestone(e.target.value)}
                  placeholder="Milestone (e.g. Ch. 1–5)"
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                <button type="submit" className="px-3 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 min-h-11">Add milestone</button>
              </form>
            )}
          </section>

          {/* Discussion (gated) */}
          <section className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700">Discussion ({posts.length})</h2>

            <form onSubmit={submitPost} className="space-y-2 border border-gray-100 rounded-lg p-3">
              <textarea value={postBody} onChange={(e) => setPostBody(e.target.value)} rows={2}
                placeholder="Share a thought — tie it to a milestone so it stays spoiler-safe..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              <div className="flex flex-wrap items-center gap-2">
                <select value={postMilestone} onChange={(e) => setPostMilestone(e.target.value)}
                  className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs" aria-label="Milestone gate">
                  <option value="">No milestone (visible to all)</option>
                  {schedule.map((m) => <option key={m.id} value={m.id}>Up to {m.label}</option>)}
                </select>
                <label className="flex items-center gap-1.5 text-xs text-gray-600">
                  <input type="checkbox" checked={postSpoiler} onChange={(e) => setPostSpoiler(e.target.checked)}
                    className="rounded border-gray-300 text-fuchsia-600 focus:ring-fuchsia-500" />
                  Spoiler
                </label>
                <button type="submit" disabled={!postBody.trim()}
                  className="ml-auto px-3 py-1.5 bg-fuchsia-600 text-white rounded-lg text-xs font-medium hover:bg-fuchsia-700 disabled:opacity-50 min-h-9">Post</button>
              </div>
            </form>

            {posts.length === 0 ? (
              <p className="text-xs text-gray-400">No posts yet.</p>
            ) : (
              <div className="space-y-2">
                {posts.map((p) => (
                  <div key={p.id} className={`rounded-lg p-3 border ${p.locked ? 'border-dashed border-gray-200 bg-gray-50' : 'border-gray-100'}`}>
                    <div className="flex items-center gap-2 mb-1 text-xs">
                      <span className="font-medium text-gray-700">{p.authorName}</span>
                      {p.milestoneLabel && <span className="text-[10px] bg-fuchsia-50 text-fuchsia-600 px-1.5 py-0.5 rounded">{p.milestoneLabel}</span>}
                      {p.isSpoiler && !p.locked && <span className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded">spoiler</span>}
                    </div>
                    {p.locked ? (
                      <p className="flex items-center gap-1.5 text-sm text-gray-400">
                        <Lock className="w-3.5 h-3.5" /> Reach <span className="font-medium">{p.milestoneLabel}</span> to unlock this post.
                      </p>
                    ) : (
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{p.body}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
