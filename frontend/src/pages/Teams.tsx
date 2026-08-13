import { useEffect, useState } from 'react';
import {
  ArrowLeft, Plus, Users, UserPlus, Trash2, Copy, Check,
  Loader2, Crown, Shield, User, LogOut,
  X, ChevronRight
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { TRexIcon } from '../components/TRexIcon';
import { teamsApi, type Team, type TeamMember } from '../api';

// ── Helpers ────────────────────────────────────────────────────────────────────

const ROLE_ICONS: Record<string, React.ReactNode> = {
  owner: <Crown className="h-3.5 w-3.5 text-amber-400" />,
  admin: <Shield className="h-3.5 w-3.5 text-indigo-400" />,
  member: <User className="h-3.5 w-3.5 text-gray-500" />,
};

function Avatar({ url, username, size = 8 }: { url?: string | null; username: string; size?: number }) {
  const s = `h-${size} w-${size}`;
  if (url) return (
    <img src={url} alt={username}
      className={`${s} rounded-full border border-white/10 object-cover flex-none`} />
  );
  return (
    <div className={`${s} rounded-full border border-white/10 bg-white/5 flex items-center justify-center text-xs font-bold text-gray-400 flex-none`}>
      {username[0]?.toUpperCase()}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="rounded border border-white/10 p-1.5 text-gray-500 hover:text-white transition">
      {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

// ── Team Detail ───────────────────────────────────────────────────────────────
function TeamDetail({ team, currentUsername, onBack, onLeft }: {
  team: Team; currentUsername: string; onBack: () => void; onLeft: () => void
}) {
  const [detail, setDetail] = useState<(Team & { members: TeamMember[] }) | null>(null);
  const [joinToken, setJoinToken] = useState(team.join_token || '');
  const [regenerating, setRegenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { void load(); }, [team.id]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await teamsApi.get(team.id);
      setDetail(res.data);
    } catch {
      setDetail(null);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (username: string) => {
    if (!confirm(`Remove @${username} from this team?`)) return;
    await teamsApi.removeMember(team.id, username);
    await load();
  };

  const handleLeave = async () => {
    if (!confirm('Leave this team?')) return;
    setLeaving(true);
    try {
      await teamsApi.leaveTeam(team.id);
      onLeft();
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Could not leave team');
    } finally {
      setLeaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Permanently delete this team? This cannot be undone.')) return;
    setDeleting(true);
    try {
      await teamsApi.deleteTeam(team.id);
      onLeft();
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Could not delete team');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-24 text-gray-600">
      <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading team…
    </div>
  );

  const myRole = detail?.members.find(m => m.username === currentUsername)?.role;
  const canManage = myRole === 'owner' || myRole === 'admin';
  const isOwner = myRole === 'owner';

  const handleRegenerateToken = async () => {
    if (!confirm('Regenerate this team token? The previous token will stop working.')) return;
    setRegenerating(true);
    try { const res = await teamsApi.regenerateToken(team.id); setJoinToken(res.data.join_token); await load(); }
    finally { setRegenerating(false); }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={onBack} className="text-gray-500 hover:text-white transition">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold text-white">{detail?.name}</h2>
          <p className="text-xs font-mono text-gray-600">/{detail?.slug} · {detail?.members.length || 0} members</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {myRole !== 'owner' && (
            <button onClick={handleLeave} disabled={leaving}
              className="flex items-center gap-1.5 rounded border border-white/10 px-3 py-1.5 text-xs text-gray-400 hover:border-red-500/40 hover:text-red-400 transition">
              <LogOut className="h-3.5 w-3.5" /> Leave
            </button>
          )}
          {myRole === 'owner' && (
            <button onClick={handleDelete} disabled={deleting}
              className="flex items-center gap-1.5 rounded border border-red-500/20 px-3 py-1.5 text-xs text-red-400 hover:border-red-400/50 transition">
              <Trash2 className="h-3.5 w-3.5" /> Delete team
            </button>
          )}
          <span className="rounded border border-white/10 px-2.5 py-1 text-xs font-mono text-gray-500 capitalize">
            {myRole}
          </span>
        </div>
      </div>

      {isOwner && (
        <div className="rounded-2xl border border-white/10 bg-[#070707] p-4 sm:p-5 space-y-3">
          <p className="text-xs font-mono uppercase tracking-widest text-gray-500">Team join token</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <code className="flex-1 rounded-xl bg-black px-3 py-3 text-sm text-white break-all">{joinToken || 'Token configured — regenerate to reveal a new token'}</code>
            {joinToken && <CopyButton text={joinToken} />}
            <button onClick={handleRegenerateToken} disabled={regenerating} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-gray-300 hover:bg-white/5 hover:text-white disabled:opacity-50">
              {regenerating ? 'Regenerating…' : 'Regenerate'}
            </button>
          </div>
          <p className="text-xs text-gray-600">Share this token with people you want to join. Regenerating invalidates the old token.</p>
        </div>
      )}

      {/* Members */}
      <div className="rounded-2xl border border-white/10 bg-[#0d0d14] overflow-hidden">
        <div className="px-5 py-3 border-b border-white/8 flex items-center justify-between">
          <p className="text-xs font-mono uppercase tracking-widest text-gray-600">Members</p>
          <Users className="h-3.5 w-3.5 text-gray-700" />
        </div>
        <div className="divide-y divide-white/5">
          {detail?.members.map(m => (
            <div key={m.id} className="flex items-center gap-3 px-5 py-3.5 group">
              <Avatar url={m.avatar_url} username={m.username} size={8} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">@{m.username}</p>
                {m.name && <p className="text-xs text-gray-600">{m.name}</p>}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-500 capitalize">
                {ROLE_ICONS[m.role]} {m.role}
              </div>
              {canManage && m.role !== 'owner' && m.username !== currentUsername && (
                <button onClick={() => handleRemove(m.username)}
                  className="opacity-0 group-hover:opacity-100 rounded border border-red-500/20 p-1.5 text-red-400/60 hover:text-red-400 hover:border-red-400/50 transition">
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selected, setSelected] = useState<Team | null>(null);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [joinInput, setJoinInput] = useState('');
  const [joining, setJoining] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentUsername, setCurrentUsername] = useState('');
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!token) { navigate('/'); return; }
    // Get current user
    const stored = localStorage.getItem('user');
    if (stored) {
      try { setCurrentUsername(JSON.parse(stored).username || ''); } catch {}
    }
    void load();
  }, [token]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await teamsApi.list();
      setTeams(res.data);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!joinInput.trim()) return;
    setJoining(true);
    try { const res = await teamsApi.joinByToken(joinInput.trim()); await load(); setJoinInput(''); setShowJoin(false); setSelected(res.data); }
    catch (e: any) { alert(e.response?.data?.detail || 'Invalid or expired team token'); }
    finally { setJoining(false); }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await teamsApi.create(newName.trim());
      await load();
      setNewName('');
      setShowCreate(false);
      setSelected(res.data);
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Failed to create team');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-gray-300 font-sans pb-24">
      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0d0d14] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white">Create Team</h2>
              <button onClick={() => setShowCreate(false)} className="rounded border border-white/10 p-1.5 text-gray-500 hover:text-white transition">
                <X className="h-4 w-4" />
              </button>
            </div>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Team name"
              autoFocus
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-white/30"
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
            />
            <p className="text-xs text-gray-600">A secure join token will be generated. Share it with members when you are ready.</p>
            <div className="flex gap-3">
              <button onClick={handleCreate} disabled={creating || !newName.trim()}
                className="flex items-center gap-2 rounded-lg border border-white bg-white px-5 py-2 text-sm font-semibold text-black hover:bg-gray-100 disabled:opacity-50 transition">
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {creating ? 'Creating…' : 'Create Team'}
              </button>
              <button onClick={() => setShowCreate(false)}
                className="rounded-lg border border-white/10 px-5 py-2 text-sm font-semibold text-gray-400 hover:text-white transition">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}


      {showJoin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0d0d14] p-6 space-y-4">
            <div className="flex items-center justify-between"><h2 className="text-base font-bold text-white">Join a Team</h2><button onClick={() => setShowJoin(false)} className="rounded border border-white/10 p-1.5 text-gray-500 hover:text-white transition"><X className="h-4 w-4" /></button></div>
            <input value={joinInput} onChange={e => setJoinInput(e.target.value.toUpperCase())} placeholder="TEAM-8X4K-29QP" className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-mono text-white placeholder:text-gray-600 focus:outline-none focus:border-white/30" onKeyDown={e => e.key === 'Enter' && handleJoin()} />
            <div className="flex gap-3"><button onClick={handleJoin} disabled={joining || !joinInput.trim()} className="flex items-center gap-2 rounded-lg border border-white bg-white px-5 py-2 text-sm font-semibold text-black hover:bg-gray-100 disabled:opacity-50 transition">{joining ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}Join Team</button><button onClick={() => setShowJoin(false)} className="rounded-lg border border-white/10 px-5 py-2 text-sm font-semibold text-gray-400 hover:text-white transition">Cancel</button></div>
          </div>
        </div>
      )}

      <nav className="border-b border-white/10 bg-black/80 sticky top-0 z-40 backdrop-blur-xl px-4 sm:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/dashboard" className="text-gray-400 hover:text-white flex items-center gap-1 text-sm font-mono transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </Link>
          <TRexIcon className="w-6 h-6 text-white" />
          <span className="text-white font-bold tracking-tight">Teams</span>
        </div>
        <div className="flex gap-2"><button onClick={() => setShowJoin(true)}
          className="flex items-center gap-1.5 rounded border border-white/10 px-3 py-1.5 text-xs font-semibold text-gray-300 hover:bg-white/5 hover:text-white transition">
          <UserPlus className="h-3.5 w-3.5" /> Join
        </button><button onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded border border-white/20 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white hover:text-black transition">
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">New Team</span>
          <span className="sm:hidden">New</span>
        </button></div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12">
        {selected ? (
          <TeamDetail
            team={selected}
            currentUsername={currentUsername}
            onBack={() => setSelected(null)}
            onLeft={() => { setSelected(null); void load(); }}
          />
        ) : (
          <>
            <div className="mb-8">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Your Teams</h1>
              <p className="text-gray-500 mt-1 text-sm">Collaborate with other Raptor users on shared repositories.</p>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-24 text-gray-600">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
              </div>
            ) : teams.length === 0 ? (
              <div className="text-center py-16 space-y-4">
                <div className="h-14 w-14 rounded-2xl border border-white/10 bg-white/3 flex items-center justify-center mx-auto">
                  <Users className="h-7 w-7 text-gray-700" />
                </div>
                <p className="text-gray-400 font-semibold">No teams yet</p>
                <p className="text-gray-600 text-sm max-w-xs mx-auto">Create a team or join one with a token from a team leader.</p>
                <div className="flex gap-2 justify-center">
                  <button onClick={() => setShowCreate(true)}
                    className="inline-flex items-center gap-2 rounded border border-white/20 px-4 py-2 text-sm text-white hover:bg-white hover:text-black transition">
                    <Plus className="h-4 w-4" /> Create your first team
                  </button>
                  <button onClick={() => setShowJoin(true)}
                    className="inline-flex items-center gap-2 rounded border border-white/10 px-4 py-2 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition">
                    <UserPlus className="h-4 w-4" /> Join a Team
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {teams.map(team => (
                  <button key={team.id} onClick={() => setSelected(team)}
                    className="w-full text-left rounded-2xl border border-white/10 bg-[#0d0d14] p-4 sm:p-5 hover:border-white/25 transition-all group">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center text-base font-bold text-white flex-none">
                        {team.name[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-white truncate">{team.name}</p>
                        <p className="text-xs font-mono text-gray-600">/{team.slug}</p>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-gray-600 capitalize">
                        {ROLE_ICONS[team.role ?? 'member']} {team.role}
                      </div>
                      <ChevronRight className="h-4 w-4 text-gray-700 group-hover:text-gray-400 transition flex-none" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
