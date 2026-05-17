import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useState } from 'react'
import { 
  GitPullRequest, 
  AlertTriangle, 
  Search,
  ChevronLeft,
  ChevronRight,
  Clock,
  ShieldCheck
} from 'lucide-react'
import { reviewsApi, type Review } from '../api'
import { formatDistanceToNow } from 'date-fns'

const severityColors = {
  critical: 'text-[#ff5f56] bg-white/[0.02] border-white/10',
  high: 'text-[#ffbd2e] bg-white/[0.02] border-white/10',
  medium: 'text-yellow-400 bg-white/[0.02] border-white/10',
  low: 'text-[#27c93f] bg-white/[0.02] border-white/10',
}

export default function Reviews() {
  const [page, setPage] = useState(0)
  const [repoFilter, setRepoFilter] = useState('')
  const limit = 10

  const { data, isLoading } = useQuery({
    queryKey: ['reviews', page, repoFilter],
    queryFn: () => reviewsApi.getAll({ 
      limit, 
      offset: page * limit,
      repo: repoFilter || undefined 
    }).then(r => r.data),
  })

  const reviews: Review[] = data?.reviews || []
  const total = data?.pagination?.total || 0
  const totalPages = Math.ceil(total / limit)

  return (
    <div className="space-y-8 font-sans pb-16 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-wide font-mono">
            REVIEW CATALOG
          </h1>
          <p className="text-gray-400 mt-1 text-sm tracking-tight font-sans">
            {total} total reviews and AST execution logs
          </p>
        </div>

        {/* Filter input */}
        <div className="flex items-center gap-3 font-mono">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              placeholder="Filter by repository..."
              value={repoFilter}
              onChange={(e) => { setRepoFilter(e.target.value); setPage(0) }}
              className="pl-10 pr-4 py-2 bg-black border border-white/20 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-white w-72 transition-colors font-mono"
            />
          </div>
        </div>
      </div>

      {/* Reviews Table Card */}
      <div className="bg-black border border-white/10 rounded-xl overflow-hidden shadow-none font-sans">
        {isLoading ? (
          <div className="flex items-center justify-center h-64 font-mono">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
          </div>
        ) : reviews.length === 0 ? (
          <div className="text-center py-20 space-y-4">
            <div className="w-12 h-12 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-white">
              <GitPullRequest className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white font-mono tracking-tight">No reviews matching filter</h3>
            <p className="text-gray-400 text-sm font-sans max-w-sm mx-auto">
              Connect a repository on the dashboard or trigger an execution scan to record PR diffs.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto font-sans">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.02] font-mono">
                  <th className="text-left py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">Repository</th>
                  <th className="text-left py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">PR Detail</th>
                  <th className="text-left py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="text-left py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">Flaw Breakdown</th>
                  <th className="text-left py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">Execution Time</th>
                  <th className="text-left py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-sm font-mono">
                {reviews.map((review) => {
                  const issuesBySeverity = review.issues.reduce((acc, issue) => {
                    acc[issue.severity] = (acc[issue.severity] || 0) + 1
                    return acc
                  }, {} as Record<string, number>)

                  return (
                    <tr key={review.id} className="hover:bg-white/[0.02] transition-colors group font-sans">
                      <td className="py-5 px-6 font-mono font-bold text-white">
                        <Link to={`/reviews/${review.id}`} className="hover:underline flex items-center gap-2">
                          {review.githubRepo}
                        </Link>
                      </td>
                      <td className="py-5 px-6">
                        <div className="flex items-center gap-2 font-mono">
                          <GitPullRequest className="w-4 h-4 text-gray-400 shrink-0" />
                          <span className="font-bold text-white">#{review.prNumber}</span>
                        </div>
                        {review.prTitle && <p className="text-xs text-gray-400 mt-1 truncate max-w-xs">{review.prTitle}</p>}
                      </td>
                      <td className="py-5 px-6 font-mono">
                        {review.status === 'pr_created' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold bg-white/5 text-[#27c93f] border border-white/10">
                            PR CREATED
                          </span>
                        ) : review.issues.length > 0 ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold bg-white/5 text-white border border-white/10">
                            <AlertTriangle className="w-3.5 h-3.5 text-[#ff5f56]" /> {review.issues.length} {review.issues.length === 1 ? 'Flaw' : 'Flaws'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold bg-white/5 text-[#27c93f] border border-white/10">
                            <ShieldCheck className="w-3.5 h-3.5 text-[#27c93f]" /> Secure
                          </span>
                        )}
                      </td>
                      <td className="py-5 px-6 font-mono">
                        <div className="flex items-center gap-2">
                          {Object.entries(issuesBySeverity).map(([severity, count]) => (
                            <span
                              key={severity}
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border ${
                                severityColors[severity as keyof typeof severityColors] || 'text-gray-400 bg-white/5 border-white/10'
                              }`}
                              title={severity}
                            >
                              {count}
                            </span>
                          ))}
                          {review.issues.length === 0 && <span className="text-gray-500">-</span>}
                        </div>
                      </td>
                      <td className="py-5 px-6 font-mono text-gray-400">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-gray-500" />
                          {review.reviewTimeMs ? `${(review.reviewTimeMs / 1000).toFixed(2)}s` : '-'}
                        </div>
                      </td>
                      <td className="py-5 px-6 font-mono text-gray-500 text-xs">
                        {formatDistanceToNow(new Date(review.createdAt), { addSuffix: true })}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination bar */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 font-mono text-xs text-gray-400 bg-white/[0.01]">
            <p>Showing {page * limit + 1} to {Math.min((page + 1) * limit, total)} of {total} reviews</p>
            <div className="flex items-center gap-3 font-mono">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-2 rounded-lg border border-white/10 hover:bg-white hover:text-black text-white transition-colors disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-bold text-white">Page {page + 1} of {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="p-2 rounded-lg border border-white/10 hover:bg-white hover:text-black text-white transition-colors disabled:opacity-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
