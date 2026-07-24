import { useQuery } from '@tanstack/react-query';
import { Loader2, GitCommit, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { reposApi } from '../api';

interface CommitAuthor {
  name: string;
  email: string;
  date: string;
}

interface Commit {
  sha: string;
  html_url: string;
  commit: {
    message: string;
    author: CommitAuthor;
  };
  author?: {
    avatar_url: string;
    login: string;
  };
}

interface CommitTimelineProps {
  repoFullName: string;
}

export default function CommitTimeline({ repoFullName }: CommitTimelineProps) {
  const [owner, repo] = repoFullName.split('/');

  const { data: commits, isLoading, error } = useQuery({
    queryKey: ['repo-commits', repoFullName],
    queryFn: () => reposApi.getRepoCommits(owner, repo).then(r => r.data),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-gray-400">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        <span className="font-mono text-sm">Loading commit history...</span>
      </div>
    );
  }

  if (error || !commits) {
    return (
      <div className="p-8 text-center text-red-400 font-mono text-sm bg-black border border-red-500/20 rounded-xl">
        Failed to load commit history.
      </div>
    );
  }

  return (
    <div className="border border-white/10 rounded-xl bg-[#0a0a0f] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 bg-black/40 border-b border-white/10">
        <GitCommit className="w-4 h-4 text-gray-500" />
        <h3 className="font-mono text-sm font-semibold text-white tracking-tight">Commit History</h3>
      </div>
      <div className="divide-y divide-white/5 max-h-[600px] overflow-y-auto custom-scrollbar">
        {commits.map((commit: Commit) => (
          <div key={commit.sha} className="p-4 hover:bg-white/[0.02] transition-colors flex gap-4">
            {commit.author?.avatar_url ? (
              <img src={commit.author.avatar_url} alt={commit.author.login} className="w-8 h-8 rounded-full border border-white/10" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-xs text-gray-500">
                {commit.commit.author.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1 gap-4">
                <a 
                  href={commit.html_url} 
                  target="_blank" 
                  rel="noreferrer"
                  className="font-semibold text-white text-sm hover:text-indigo-400 transition-colors truncate"
                >
                  {commit.commit.message.split('\n')[0]}
                </a>
                <a 
                  href={commit.html_url}
                  target="_blank"
                  rel="noreferrer" 
                  className="font-mono text-xs text-gray-500 hover:text-white transition-colors flex items-center gap-1 shrink-0"
                >
                  {commit.sha.substring(0, 7)}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500 font-mono">
                <span className="text-gray-400">{commit.author?.login || commit.commit.author.name}</span>
                <span>•</span>
                <span>{formatDistanceToNow(new Date(commit.commit.author.date), { addSuffix: true })}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
