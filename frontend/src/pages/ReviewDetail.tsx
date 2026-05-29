import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { 
  GitPullRequest, 
  ArrowLeft,
  Shield,
  Zap,
  Code2,
  Layout,
  FileCode,
  ExternalLink,
  CheckCircle2,
  GitBranchPlus
} from 'lucide-react'
import { reviewsApi, prApi, type CreatePullRequestResponse, type Review } from '../api'
import { format } from 'date-fns'

const severityConfig = {
  critical: { color: 'text-[#ff5f56]', dot: 'bg-[#ff5f56]', border: 'border-white/10 hover:border-white/20' },
  high: { color: 'text-[#ffbd2e]', dot: 'bg-[#ffbd2e]', border: 'border-white/10 hover:border-white/20' },
  medium: { color: 'text-yellow-400', dot: 'bg-yellow-400', border: 'border-white/10 hover:border-white/20' },
  low: { color: 'text-[#27c93f]', dot: 'bg-[#27c93f]', border: 'border-white/10 hover:border-white/20' },
}

type FixPrInfo = { url: string; number: number | null }

const getSafePullRequestsUrl = (url: string) => {
  try {
    const parsedUrl = new URL(url)
    const [owner, repo] = parsedUrl.pathname.split('/').filter(Boolean)

    if (parsedUrl.hostname === 'github.com' && owner && repo) {
      return `https://github.com/${owner}/${repo}/pulls`
    }
  } catch {
    return url
  }

  return url
}

const toFixPrInfo = (response: CreatePullRequestResponse): FixPrInfo => ({
  url: getSafePullRequestsUrl(response.prUrl),
  number: null,
})

const categoryConfig = {
  security: { icon: Shield, label: 'Security' },
  performance: { icon: Zap, label: 'Performance' },
  quality: { icon: Code2, label: 'Code Quality' },
  design: { icon: Layout, label: 'Design' },
}

function IssueCard({ issue }: { issue: Review['issues'][0] }) {
  const severity = severityConfig[issue.severity]
  const category = categoryConfig[issue.category]
  const CategoryIcon = category.icon

  return (
    <div className={`bg-black p-6 rounded-xl border transition-colors font-sans ${severity.border}`}>
      <div className="flex items-start justify-between gap-4 font-sans">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 font-mono">
            <span className={`w-3 h-3 rounded-full ${severity.dot} shrink-0`} />
            <h4 className="font-bold text-white text-lg font-mono tracking-tight">{issue.title}</h4>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400 font-mono">
            <FileCode className="w-4 h-4 text-white" />
            <span className="text-gray-300 bg-white/5 px-2.5 py-1 rounded border border-white/10 font-mono font-bold">
              {issue.file}:{issue.line}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 font-mono font-sans">
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-white/5 text-gray-300 border border-white/10 font-mono">
            {issue.severity}
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-bold bg-white/5 text-white border border-white/10 font-mono">
            <CategoryIcon className="w-3.5 h-3.5" />
            {category.label}
          </span>
        </div>
      </div>

      <p className="text-sm sm:text-base text-gray-300 leading-relaxed font-sans mt-4 mb-4">{issue.description}</p>

      <div className="bg-white/[0.02] rounded-xl p-5 border border-white/10 space-y-2.5 font-sans">
        <div className="flex items-center gap-2 text-xs text-white font-bold uppercase tracking-wider font-mono">
          <CheckCircle2 className="w-4 h-4 text-white" /> AI Diff Suggestion & Fix
        </div>
        <code className="block text-xs font-mono text-gray-200 bg-black p-4 rounded-lg border border-white/10 overflow-x-auto">
          {issue.suggestion}
        </code>
      </div>
    </div>
  )
}

export default function ReviewDetail() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const [createdPrInfo, setCreatedPrInfo] = useState<FixPrInfo | null>(null)
  const [prError, setPrError] = useState<string | null>(null)

  const { data: review, isLoading } = useQuery({
    queryKey: ['review', id],
    queryFn: () => reviewsApi.getById(Number(id)).then(r => r.data as Review),
  })

  const prMutation = useMutation<CreatePullRequestResponse, unknown, void>({
    mutationFn: () => prApi.createPullRequest(Number(id)),
    onMutate: () => {
      setPrError(null)
    },
    onSuccess: (res) => {
      setCreatedPrInfo(toFixPrInfo(res))
      queryClient.invalidateQueries({ queryKey: ['review', id] })
      queryClient.invalidateQueries({ queryKey: ['reviews-recent'] })
    },
    onError: (err: unknown) => {
      const message = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
        : undefined
      setPrError(message || 'Unable to create a fix pull request. Please try again.')
    },
  })

  useEffect(() => {
    if (review?.fixPrUrl) {
      setCreatedPrInfo({ url: getSafePullRequestsUrl(review.fixPrUrl), number: null })
    }
  }, [review?.fixPrNumber, review?.fixPrUrl])

  const activeFixPr = createdPrInfo || (review?.fixPrUrl
    ? { url: getSafePullRequestsUrl(review.fixPrUrl), number: null }
    : null)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 font-mono font-sans">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
      </div>
    )
  }

  if (!review) {
    return (
      <div className="bg-black border border-white/10 p-12 text-center font-mono space-y-4 max-w-md mx-auto mt-12 rounded-xl font-sans">
        <h2 className="text-xl font-bold text-white font-mono">Review record not found</h2>
        <p className="text-gray-400 text-sm font-sans">The requested AST scan ID does not exist or has expired.</p>
        <Link to="/reviews" className="bg-white text-black px-6 py-2.5 rounded font-mono font-semibold inline-block mt-4">
          Return to Catalog
        </Link>
      </div>
    )
  }

  const issuesBySeverity = review.issues.reduce((acc, issue) => {
    acc[issue.severity] = (acc[issue.severity] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="space-y-8 font-sans pb-16 animate-fadeIn font-sans">
      {/* Navigation Bar */}
      <div className="flex items-center justify-between font-sans">
        <Link 
          to="/reviews" 
          className="inline-flex items-center gap-2 text-xs font-mono font-bold text-gray-400 hover:text-white transition-colors bg-white/5 px-4 py-2 rounded-lg border border-white/10"
        >
          <ArrowLeft className="w-4 h-4" /> Return to Review Catalog
        </Link>
      </div>

      {/* Review Header Card */}
      <div className="bg-black border border-white/10 p-8 rounded-xl space-y-6 font-sans font-sans">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 font-sans">
          <div className="space-y-4 font-sans">
            <div className="flex items-center gap-4 font-sans">
              <div className="p-3.5 bg-white/5 rounded-lg border border-white/10 text-white font-sans">
                <GitPullRequest className="w-6 h-6 text-white" />
              </div>
              <div className="space-y-1 font-sans">
                <div className="flex items-center gap-3 font-sans">
                  <h1 className="text-2xl sm:text-3xl font-bold text-white font-mono tracking-tight font-mono">
                    {review.githubRepo} #{review.prNumber}
                  </h1>
                  <span className="text-xs uppercase font-mono px-2.5 py-0.5 rounded font-bold border bg-white/5 text-white border-white/10 font-mono font-bold">
                    {activeFixPr ? 'PR Ready' : review.status.replace('_', ' ')}
                  </span>
                </div>
                {review.prTitle && <p className="text-gray-300 text-sm font-sans">{review.prTitle}</p>}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6 text-xs font-mono text-gray-400 pt-2 border-t border-white/10 font-mono">
              <span>Scanned: {format(new Date(review.createdAt), 'MMM d, yyyy HH:mm')}</span>
              {review.reviewTimeMs && <span>AST Execution Time: {(review.reviewTimeMs / 1000).toFixed(2)}s</span>}
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 font-sans font-mono font-semibold font-sans">
            {review.prUrl && (
              <a 
                href={review.prUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/5 text-gray-200 rounded text-xs font-bold font-mono hover:bg-white/10 hover:text-white transition-colors border border-white/10 font-mono"
              >
                View on GitHub
                <ExternalLink className="w-3.5 h-3.5 text-white" />
              </a>
            )}

            {/* Automated PR Creation Trigger Button */}
            {review.issues.length > 0 && (
              activeFixPr ? (
                <a
                  href={activeFixPr.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded font-mono font-bold text-xs uppercase tracking-wider bg-white text-black hover:bg-gray-200 transition-colors font-mono font-bold font-mono"
                >
                  <GitBranchPlus className="w-4 h-4 text-black" />
                  Open Pull Requests
                </a>
              ) : (
                <button
                  onClick={() => prMutation.mutate()}
                  disabled={prMutation.isPending}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded font-mono font-bold text-xs uppercase tracking-wider bg-white text-black hover:bg-gray-200 transition-colors disabled:opacity-50 font-mono font-bold font-mono"
                >
                  <GitBranchPlus className={`w-4 h-4 text-black ${prMutation.isPending ? 'animate-spin' : ''}`} />
                  {prMutation.isPending ? 'Generating Fix PR...' : 'Create Fix PR'}
                </button>
              )
            )}
          </div>
        </div>

        {/* PR Creation Success Toast/Banner */}
        {activeFixPr && (
          <div className="p-5 rounded-lg bg-white/5 border border-white/15 flex items-center justify-between font-mono text-sm animate-fadeIn font-sans font-mono font-sans font-mono">
            <div className="flex items-center gap-3 text-white font-bold font-mono">
              <CheckCircle2 className="w-5 h-5 text-[#27c93f] shrink-0 font-mono font-bold font-mono font-mono" />
              <span>No GitHub PR was auto-created. Open the repository Pull Requests page to create one from the suggested fixes.</span>
            </div>
            <a 
              href={activeFixPr.url}
              target="_blank" 
              rel="noopener noreferrer"
              className="px-4 py-2 bg-white text-black font-bold font-mono rounded hover:bg-gray-200 text-xs tracking-wider uppercase transition-colors shrink-0 font-mono font-bold font-mono font-mono"
            >
              Open Pull Requests
            </a>
          </div>
        )}

        {prError && (
          <div className="p-4 rounded-lg bg-[#ff5f56]/10 border border-[#ff5f56]/30 text-[#ffb3ad] font-mono text-sm">
            {prError}
          </div>
        )}


        {review.summary && (
          <div className="p-5 bg-white/[0.02] rounded-lg border border-white/10 font-sans text-sm text-gray-300 leading-relaxed font-sans font-sans font-sans">
            <p className="font-mono text-xs font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-1.5 font-mono font-bold font-mono">
              <Shield className="w-3.5 h-3.5 text-white font-mono font-bold font-mono font-mono" /> Executive AST Summary
            </p>
            {review.summary}
          </div>
        )}

        {/* Issue Severity Badges */}
        {review.issues.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-white/10 font-mono text-xs font-sans font-mono">
            {Object.entries(issuesBySeverity).map(([sev, count]) => (
              <div key={sev} className="flex items-center gap-2 px-3 py-1 rounded bg-white/5 border border-white/10 font-mono font-mono font-mono">
                <span className={`w-2.5 h-2.5 rounded-full ${
                  sev === 'critical' ? 'bg-[#ff5f56]' :
                  sev === 'high' ? 'bg-[#ffbd2e]' :
                  sev === 'medium' ? 'bg-yellow-400' : 'bg-[#27c93f]'
                }`} />
                <span className="text-gray-300 uppercase font-bold tracking-wider font-mono font-bold font-mono font-mono font-mono">{sev}: {count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Issues Catalog */}
      <div className="space-y-4 font-sans font-sans font-sans">
        <h2 className="text-lg font-bold text-white font-mono uppercase tracking-wider font-mono font-bold font-mono font-mono">
          Detected Vulnerabilities & Flaws ({review.issues.length})
        </h2>

        {review.issues.length === 0 ? (
          <div className="bg-black border border-white/10 text-center py-20 rounded-xl font-sans font-sans font-sans font-sans font-sans">
            <div className="w-16 h-16 bg-white/5 border border-white/10 rounded-lg flex items-center justify-center mx-auto mb-4 font-sans font-sans font-sans font-sans font-sans font-sans">
              <Shield className="w-8 h-8 text-white font-sans font-sans font-sans font-sans font-sans font-sans font-sans" />
            </div>
            <h3 className="text-xl font-bold text-white font-mono tracking-tight font-mono font-bold font-mono font-mono font-mono font-mono font-mono">Zero Flaws Detected</h3>
            <p className="text-gray-400 font-sans mt-1 text-sm max-w-md mx-auto font-sans font-sans font-sans font-sans font-sans font-sans font-sans font-sans">This repository branch passed all AST execution rules perfectly without security or performance leaks.</p>
          </div>
        ) : (
          review.issues.map((issue, index) => (
            <IssueCard key={index} issue={issue} />
          ))
        )}
      </div>
    </div>
  )
}
