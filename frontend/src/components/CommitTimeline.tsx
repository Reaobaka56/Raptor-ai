import { useState, useEffect } from 'react';
import { Loader2, GitCommit, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { repoExplorerApi, type Commit } from '../api';

interface CommitTimelineProps {
  repoFullName: string;
}

export default function CommitTimeline({ repoFullName }: CommitTimelineProps) {
  const [owner, repo] = repoFullName.split('/');
  const [commits, setCommits] = useState<Commit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!owner || !repo) return;
    repoExplorerApi.getCommits(owner, repo)
      .then(r => setCommits(r.data))
      .catch(() => setError('Failed to load commit history'))
      .finally(() => setLoading(false));
  }, [owner, repo]);

  if (loading) return (
    <div className="flex items-center justify-center p-12 text-gray-400">
      <Loader2 className="h-6 w-6 animate-spin mr-2" />
      <span className="font-mono text-sm">Loading commit history...</span>
    </div>
  );

  if (error) return (
    <div className="p-8 text-center text-red-400 font-mono text-sm bg-black border border-red-500/20 rounded-xl">
      {error}
    </div>
  );

  return (
    <div className="border border-white/10 rounded-xl bg-[#0a0a0f] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 bg-black/40 border-b border-white/10">
        <GitCommit className="w-4 h-4 text-gray-500" />
        <h3 className="font-mono text-sm font-semibold text-white tracking-tight">Commit History</h3>
      </div>
      <div className="divide-y divide-white/5 max-h-[600px] overflow-y-auto">
        {commits.length === 0 && (
          <div className="p-8 text-center text-gray-600 text-sm font-mono">No commits found</div>
        )}
        {commits.map((commit) => (
          <div key={commit.sha} className="p-4 hover:bg-white/[0.02] transition-colors flex gap-4">
            {commit.author.avatar_url ? (
              <img src={commit.author.avatar_url} alt={commit.author.login || commit.author.name}
                className="w-8 h-8 rounded-full border border-white/10 flex-none" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-xs text-gray-500 flex-none">
                {commit.author.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1 gap-4">
                <span className="font-semibold text-white text-sm truncate">{commit.message}</span>
                <a href={commit.html_url} target="_blank" rel="noreferrer"
                  className="font-mono text-xs text-gray-500 hover:text-white transition-colors flex items-center gap-1 shrink-0">
                  {commit.short_sha}<ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500 font-mono">
                <span className="text-gray-400">{commit.author.login || commit.author.name}</span>
                <span>•</span>
                <span>{formatDistanceToNow(new Date(commit.date), { addSuffix: true })}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
