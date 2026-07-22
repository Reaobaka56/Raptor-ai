import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Users, Check, X, Loader2 } from 'lucide-react';
import { teamsApi, type Invitation } from '../api';

export default function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [inv, setInv] = useState<Invitation | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const isLoggedIn = Boolean(localStorage.getItem('token'));

  useEffect(() => {
    if (!token) return;
    teamsApi.getInvitation(token)
      .then(r => setInv(r.data))
      .catch(() => setError('Invitation not found or already used.'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleAccept = async () => {
    if (!token) return;
    setAccepting(true);
    try {
      await teamsApi.acceptInvitation(token);
      setDone(true);
      setTimeout(() => navigate('/teams'), 2000);
    } catch {
      setError('Failed to accept invitation. It may have expired or already been used.');
    } finally {
      setAccepting(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0d0d14] p-8 text-center space-y-5">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
          <Users className="h-7 w-7 text-indigo-400" />
        </div>

        {loading && (
          <div className="flex items-center justify-center gap-2 text-gray-500 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading invitation…
          </div>
        )}

        {!loading && error && (
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-2 text-red-400">
              <X className="h-5 w-5" />
              <p className="font-semibold">Invalid invitation</p>
            </div>
            <p className="text-sm text-gray-500">{error}</p>
            <Link to="/" className="block text-sm text-indigo-400 hover:text-indigo-300 transition">
              Return home
            </Link>
          </div>
        )}

        {!loading && !error && inv && !done && (
          <div className="space-y-4">
            <p className="text-gray-400 text-sm">
              <span className="font-semibold text-white">@{inv.invited_by_username}</span> invited you to join
            </p>
            <h2 className="text-2xl font-bold text-white">{inv.team_name}</h2>
            <p className="text-xs font-mono text-gray-600 capitalize">Role: {inv.role}</p>

            {!isLoggedIn ? (
              <div className="space-y-3 pt-2">
                <p className="text-sm text-gray-500">Log in with GitHub first to accept this invitation.</p>
                <Link to="/"
                  className="block rounded-lg border border-white bg-white px-5 py-2.5 text-sm font-semibold text-black hover:bg-gray-100 transition">
                  Login with GitHub
                </Link>
              </div>
            ) : (
              <button onClick={handleAccept} disabled={accepting}
                className="flex items-center justify-center gap-2 w-full rounded-lg border border-white bg-white px-5 py-2.5 text-sm font-semibold text-black hover:bg-gray-100 disabled:opacity-50 transition">
                {accepting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {accepting ? 'Joining…' : 'Accept & Join Team'}
              </button>
            )}
          </div>
        )}

        {done && (
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-2 text-green-400">
              <Check className="h-5 w-5" />
              <p className="font-semibold">Joined successfully!</p>
            </div>
            <p className="text-sm text-gray-500">Redirecting to your teams…</p>
          </div>
        )}
      </div>
    </div>
  );
}
