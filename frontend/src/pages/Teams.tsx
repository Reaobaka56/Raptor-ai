import { useEffect, useState } from 'react';
import { ArrowLeft, Plus, Users, UserPlus, Trash2, Copy, Check, Loader2, Crown, Shield, User } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { TRexIcon } from '../components/TRexIcon';
import { teamsApi, type Team, type TeamMember, type Invitation } from '../api';

const ROLE_ICONS: Record<string, React.ReactNode> = {
  owner: <Crown className="h-3 w-3 text-amber-400" />,
  admin: <Shield className="h-3 w-3 text-indigo-400" />,
  member: <User className="h-3 w-3 text-gray-500" />,
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy}
      className="rounded border border-white/10 p-1.5 text-gray-500 hover:text-white transition">
      {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

function TeamDetail({ team, onBack }: { team: Team; onBack: () => void }) {
  const [detail, setDetail] = useState<(Team & { members: TeamMember[] }) | null>(null);
  const [inviteInput, setInviteInput] = useState('');
  const [inviteMode, setInviteMode] = useState<'github' | 'email'>('github');
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [inviteLink, setInviteLink] = useState('');

  useEffect(() => { void load(); }, [team.id]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await teamsApi.get(team.id);
      setDetail(res.data);
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteInput.trim()) return;
    setInviting(true);
    try {
      const payload = inviteMode === 'email'
        ? { invitee_email: inviteInput.trim() }
        : { invitee_github: inviteInput.trim() };
      const res = await teamsApi.invite(team.id, payload);
      const token = res.data.invite_token;
      const link = `${window.location.origin}/teams/accept/${token}`;
      setInviteLink(link);
      setInvitations(prev => [res.data, ...prev]);
      setInviteInput('');
    } catch {
      alert('Failed to create invitation. Make sure you have admin permissions.');
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (username: string) => {
    if (!confirm(`Remove @${username} from this team?`)) return;
    await teamsApi.removeMember(team.id, username);
    await load();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-600">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading team…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-gray-500 hover:text-white transition">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h2 className="text-xl font-bold text-white">{detail?.name}</h2>
          <p className="text-xs font-mono text-gray-600">/{detail?.slug}</p>
        </div>
        <span className="ml-auto text-xs font-mono text-gray-600 border border-white/10 rounded px-2 py-1 capitalize">
          {team.role}
        </span>
      </div>

      {/* Members */}
      <div className="rounded-2xl border border-white/10 bg-[#0d0d14] p-5 space-y-3">
        <p className="text-xs font-mono uppercase tracking-widest text-gray-600 mb-4">Members</p>
        {detail?.members.map(m => (
          <div key={m.id} className="flex items-center gap-3 group">
            {m.avatar_url ? (
              <img src={m.avatar_url} alt={m.username} className="h-7 w-7 rounded-full border border-white/10" />
            ) : (
              <div className="h-7 w-7 rounded-full border border-white/10 bg-white/5 flex items-center justify-center text-xs text-gray-500">
                {m.username[0].toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <span className="text-sm font-semibold text-white">@{m.username}</span>
              {m.name && <span className="text-xs text-gray-500 ml-2">{m.name}</span>}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-500 capitalize">
              {ROLE_ICONS[m.role]} {m.role}
            </div>
            {m.role !== 'owner' && (team.role === 'owner' || team.role === 'admin') && (
              <button onClick={() => handleRemove(m.username)}
                className="opacity-0 group-hover:opacity-100 rounded border border-red-500/20 p-1 text-red-400/60 hover:text-red-400 hover:border-red-400/50 transition">
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Invite */}
      {(team.role === 'owner' || team.role === 'admin') && (
        <div className="rounded-2xl border border-white/10 bg-[#0d0d14] p-5 space-y-4">
          <p className="text-xs font-mono uppercase tracking-widest text-gray-600">Invite</p>
          <div className="flex gap-2">
            <button onClick={() => setInviteMode('github')}
              className={`rounded px-3 py-1.5 text-xs font-semibold transition ${inviteMode === 'github' ? 'bg-white text-black' : 'border border-white/10 text-gray-400 hover:text-white'}`}>
              GitHub username
            </button>
            <button onClick={() => setInviteMode('email')}
              className={`rounded px-3 py-1.5 text-xs font-semibold transition ${inviteMode === 'email' ? 'bg-white text-black' : 'border border-white/10 text-gray-400 hover:text-white'}`}>
              Email
            </button>
          </div>
          <div className="flex gap-2">
            <input value={inviteInput} onChange={e => setInviteInput(e.target.value)}
              placeholder={inviteMode === 'github' ? 'GitHub username' : 'Email address'}
              className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-white/30"
              onKeyDown={e => e.key === 'Enter' && handleInvite()} />
            <button onClick={handleInvite} disabled={inviting || !inviteInput.trim()}
              className="flex items-center gap-1.5 rounded-lg border border-white bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-gray-100 disabled:opacity-50 transition">
              {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              Invite
            </button>
          </div>
          {inviteLink && (
            <div className="flex items-center gap-2 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-2">
              <p className="flex-1 text-xs font-mono text-indigo-300 truncate">{inviteLink}</p>
              <CopyButton text={inviteLink} />
            </div>
          )}
          <p className="text-xs text-gray-600">Invite links expire after 7 days. Anyone with the link can join this team.</p>
        </div>
      )}
    </div>
  );
}

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selected, setSelected] = useState<Team | null>(null);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!token) { navigate('/'); return; }
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

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await teamsApi.create(newName.trim());
      setTeams(prev => [res.data, ...prev]);
      setNewName('');
      setShowCreate(false);
      setSelected(res.data);
    } catch {
      alert('Failed to create team.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-gray-300 font-sans pb-24">
      <nav className="border-b border-white/10 bg-black/80 sticky top-0 z-50 backdrop-blur-xl px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/dashboard" className="text-gray-400 hover:text-white flex items-center gap-1 text-sm font-mono transition-colors">
            <ArrowLeft className="w-4 h-4" /> Dashboard
          </Link>
          <TRexIcon className="w-6 h-6 text-white" />
          <span className="text-white font-bold tracking-tight text-lg">Teams</span>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded border border-white/20 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white hover:text-black transition">
          <Plus className="h-3.5 w-3.5" /> New Team
        </button>
      </nav>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0d0d14] p-6 space-y-4">
            <h2 className="text-lg font-bold text-white">Create Team</h2>
            <input value={newName} onChange={e => setNewName(e.target.value)}
              placeholder="Team name"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-white/30"
              onKeyDown={e => e.key === 'Enter' && handleCreate()} />
            <div className="flex gap-3">
              <button onClick={handleCreate} disabled={creating || !newName.trim()}
                className="flex items-center gap-2 rounded-lg border border-white bg-white px-5 py-2 text-sm font-semibold text-black hover:bg-gray-100 disabled:opacity-50 transition">
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {creating ? 'Creating…' : 'Create'}
              </button>
              <button onClick={() => setShowCreate(false)}
                className="rounded-lg border border-white/10 px-5 py-2 text-sm font-semibold text-gray-400 hover:text-white transition">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-3xl mx-auto px-6 pt-12">
        {selected ? (
          <TeamDetail team={selected} onBack={() => setSelected(null)} />
        ) : (
          <>
            <h1 className="text-3xl font-extrabold text-white tracking-tight mb-2">Your Teams</h1>
            <p className="text-gray-500 mb-10 text-sm">Collaborate with other GitHub users on shared Raptor AI projects.</p>

            {loading ? (
              <div className="flex items-center justify-center py-24 text-gray-600">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
              </div>
            ) : teams.length === 0 ? (
              <div className="text-center py-24 space-y-4">
                <Users className="h-12 w-12 text-gray-700 mx-auto" />
                <p className="text-gray-500 text-sm">You're not in any teams yet.</p>
                <button onClick={() => setShowCreate(true)}
                  className="flex items-center gap-2 mx-auto rounded border border-white/20 px-4 py-2 text-sm text-white hover:bg-white hover:text-black transition">
                  <Plus className="h-4 w-4" /> Create your first team
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {teams.map(team => (
                  <button key={team.id} onClick={() => setSelected(team)}
                    className="w-full text-left rounded-2xl border border-white/10 bg-[#0d0d14] p-5 hover:border-white/25 transition-all group">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center text-sm font-bold text-white">
                        {team.name[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-white">{team.name}</p>
                        <p className="text-xs font-mono text-gray-600">/{team.slug}</p>
                      </div>
                      <div className="ml-auto flex items-center gap-1.5 text-xs text-gray-600 capitalize">
                        {ROLE_ICONS[team.role ?? 'member']} {team.role}
                      </div>
                      <ArrowLeft className="h-4 w-4 text-gray-700 rotate-180 group-hover:text-white transition-colors" />
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
