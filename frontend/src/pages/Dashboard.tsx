import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { 
  GitPullRequest, 
  AlertTriangle, 
  Clock, 
  Shield,
  Zap,
  Code2,
  Layout,
  ArrowRight,
  Play,
  Lock,
  Globe
} from 'lucide-react'
import { statsApi, reviewsApi, reposApi, type Stats, type Review, type UserProfile } from '../api'
import { formatDistanceToNow } from 'date-fns'

function StatCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon
}: { 
  title: string
  value: string | number
  subtitle?: string
  icon: React.ElementType
}) {
  return (
    <div className="bg-black border border-white/10 p-6 rounded-xl transition-colors hover:border-white/20 font-sans">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-mono uppercase text-gray-400 tracking-wider font-semibold">{title}</p>
          <p className="text-3xl font-bold text-white mt-1 tracking-tight font-mono">{value}</p>
          {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
        </div>
        <div className="p-3 bg-white/5 text-gray-400 rounded-lg border border-white/10">
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
    </div>
  )
}

function SeverityBar({ stats }: { stats: Stats['issuesBySeverity'] }) {
  const total = stats.critical + stats.high + stats.medium + stats.low
  if (total === 0) return null

  const segments = [
    { label: 'Critical', value: stats.critical, color: 'bg-[#ff5f56]', width: (stats.critical / total) * 100 },
    { label: 'High', value: stats.high, color: 'bg-[#ffbd2e]', width: (stats.high / total) * 100 },
    { label: 'Medium', value: stats.medium, color: 'bg-yellow-500', width: (stats.medium / total) * 100 },
    { label: 'Low', value: stats.low, color: 'bg-[#27c93f]', width: (stats.low / total) * 100 },
  ]

  return (
    <div className="bg-black border border-white/10 p-6 rounded-xl font-sans">
      <h3 className="text-sm font-mono uppercase tracking-wider text-white mb-4 font-bold flex items-center gap-2">
        <Shield className="w-4 h-4 text-white" /> Issues by Severity
      </h3>
      <div className="flex h-3 rounded-full overflow-hidden mb-6 bg-white/5 border border-white/10">
        {segments.map((seg) => (
          seg.value > 0 && (
            <div
              key={seg.label}
              className={seg.color}
              style={{ width: `${seg.width}%` }}
              title={`${seg.label}: ${seg.value}`}
            />
          )
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono">
        {segments.map((seg) => (
          <div key={seg.label} className="p-3 bg-white/[0.02] border border-white/5 rounded-lg text-center">
            <div className={`w-2.5 h-2.5 rounded-full ${seg.color} mx-auto mb-2`} />
            <p className="text-lg font-bold text-white tracking-tight">{seg.value}</p>
            <p className="text-xs text-gray-400 font-sans mt-0.5">{seg.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function CategoryGrid({ stats }: { stats: Stats['issuesByCategory'] }) {
  const categories = [
    { label: 'Security', value: stats.security, icon: Shield },
    { label: 'Performance', value: stats.performance, icon: Zap },
    { label: 'Quality', value: stats.quality, icon: Code2 },
    { label: 'Design', value: stats.design, icon: Layout },
  ]

  return (
    <div className="grid grid-cols-2 gap-4 font-sans">
      {categories.map((cat) => {
        const Icon = cat.icon
        return (
          <div key={cat.label} className="bg-black border border-white/10 p-5 rounded-xl flex flex-col justify-between hover:border-white/20 transition-colors">
            <div className="p-2.5 bg-white/5 text-white rounded-lg w-fit border border-white/10 mb-3">
              <Icon className="w-4 h-4" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white font-mono">{cat.value}</p>
              <p className="text-xs font-mono uppercase tracking-wider text-gray-400 mt-1">{cat.label}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function RecentReviews({ reviews }: { reviews: Review[] }) {
  return (
    <div className="bg-black border border-white/10 p-6 rounded-xl font-sans">
      <div className="flex items-center justify-between mb-6 border-b border-white/10 pb-4 font-mono">
        <h3 className="text-sm uppercase tracking-wider text-white font-bold flex items-center gap-2">
          <GitPullRequest className="w-4 h-4 text-white" /> Recent Scans & Reviews
        </h3>
        <Link to="/reviews" className="text-xs text-gray-400 hover:text-white flex items-center gap-1 transition-colors font-semibold">
          View all <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
      <div className="space-y-3 font-mono text-sm">
        {reviews.length === 0 ? (
          <p className="text-gray-500 text-center py-8 font-sans">No scans recorded yet.</p>
        ) : (
          reviews.map((review) => (
            <Link
              key={review.id}
              to={`/reviews/${review.id}`}
              className="flex items-center justify-between p-4 rounded-lg bg-white/[0.02] border border-white/10 hover:border-white/30 hover:bg-white/5 transition-all"
            >
              <div className="flex items-center gap-3 min-w-0 font-sans">
                <div className="p-2 bg-white/5 rounded-lg border border-white/10 shrink-0 text-white">
                  <GitPullRequest className="w-4 h-4 text-white" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-white truncate font-mono">
                      {review.githubRepo} #{review.prNumber}
                    </p>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-white/10 text-gray-300 border border-white/10 font-semibold">
                      {review.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 truncate mt-0.5">
                    {review.prTitle || 'Autonomous PR scan'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 shrink-0 font-mono">
                {review.issues.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold bg-white/10 text-white border border-white/20">
                    <AlertTriangle className="w-3.5 h-3.5 text-[#ff5f56]" />
                    {review.issues.length} {review.issues.length === 1 ? 'issue' : 'issues'}
                  </span>
                )}
                <span className="text-xs text-gray-500">
                  {formatDistanceToNow(new Date(review.createdAt), { addSuffix: true })}
                </span>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [user, setUser] = useState<UserProfile | null>(null)
  const [scanningRepo, setScanningRepo] = useState<string | null>(null)
  const [customUrl, setCustomUrl] = useState('')
  const [scanError, setScanError] = useState<string | null>(null)


  useEffect(() => {
    const checkAuth = () => {
      const storedUser = localStorage.getItem('user')
      if (storedUser) {
        try {
          setUser(JSON.parse(storedUser))
        } catch (e) {
          localStorage.removeItem('user')
        }
      } else {
        setUser(null)
      }
    }
    checkAuth()
    window.addEventListener('auth-change', checkAuth)
    return () => window.removeEventListener('auth-change', checkAuth)
  }, [])

  const { data: statsData } = useQuery({
    queryKey: ['stats'],
    queryFn: () => statsApi.getStats().then(r => r.data as Stats),
  })

  const { data: reviewsData } = useQuery({
    queryKey: ['reviews-recent'],
    queryFn: () => reviewsApi.getAll({ limit: 5 }).then(r => r.data.reviews as Review[]),
  })

  const { data: reposData } = useQuery({
    queryKey: ['repositories', user?.username],
    queryFn: () => reposApi.getRepos().then(r => r.data),
    enabled: !!user,
  })



  const handleScan = async (repoName: string) => {
    const targetRepo = repoName.trim()
    if (!targetRepo || scanningRepo) return

    setScanError(null)
    setScanningRepo(targetRepo)
    try {
      const res = await reposApi.scanRepo(targetRepo)
      await queryClient.invalidateQueries({ queryKey: ['reviews-recent'] })
      await queryClient.invalidateQueries({ queryKey: ['repositories', user?.username] })
      await queryClient.invalidateQueries({ queryKey: ['stats'] })
      navigate(`/reviews/${res.data.id}`)
    } catch (err) {
      console.error('Failed to scan repository', err)
      const message = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
        : undefined
      setScanError(message || 'Unable to start the repository scan. Please check the repository URL and try again.')
    } finally {
      setScanningRepo(null)
    }
  }

  const stats = statsData
  const reviews = reviewsData || []
  const repositories = reposData || []

  return (
    <div className="space-y-8 font-sans pb-16 animate-fadeIn">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-wide font-mono">DASHBOARD</h1>
          <p className="text-gray-400 mt-1 text-sm tracking-tight font-sans">Autonomous AI Code Review & AST Execution Gateway</p>
        </div>
        {user && (
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded text-xs font-mono bg-white/5 text-white border border-white/10 font-semibold">
              <span className="w-2 h-2 rounded-full bg-[#27c93f]" /> Connected as {user.username}
            </span>
          </div>
        )}
      </div>

      <div className="bg-black border border-white/10 rounded-lg p-6">
        <h2 className="text-xl font-bold text-white tracking-wide font-mono mb-4">Scan Public Repository</h2>
        <div className="flex gap-4">
          <input
            type="text"
            value={customUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
            placeholder="https://github.com/owner/repo"
            className="flex-1 bg-white/5 border border-white/10 rounded px-4 py-2 text-white font-mono text-sm focus:outline-none focus:border-white/30"
            disabled={!!scanningRepo}
          />
          <button
            onClick={() => handleScan(customUrl)}
            disabled={!customUrl.trim() || !!scanningRepo}
            className="inline-flex items-center gap-2 bg-white text-black hover:bg-gray-200 px-6 py-2 rounded font-bold transition-colors disabled:opacity-50"
          >
            <Play className={`w-4 h-4 ${scanningRepo === customUrl.trim() ? 'animate-spin' : ''}`} />
            {scanningRepo === customUrl.trim() ? 'Scanning...' : 'Scan URL'}
          </button>
        </div>
        {scanError && (
          <div className="mt-4 rounded-lg border border-[#ff5f56]/30 bg-[#ff5f56]/10 px-4 py-3 text-sm text-[#ffb3ad] font-mono">
            {scanError}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-sans">
        {repositories.length === 0 ? (
          <div className="col-span-full rounded-xl bg-black border border-white/10 p-8 text-center text-gray-400">
            <p className="text-lg font-semibold text-white mb-2">No connected repositories yet</p>
            <p className="text-sm text-gray-400 max-w-xl mx-auto">
              Connect your GitHub account and authorize repositories, or scan a public repository using the form above to see repository state here.
            </p>
          </div>
        ) : (
          repositories.map((repo) => (
            <div 
              key={repo.id}
              className="p-5 rounded-lg bg-black border border-white/10 hover:border-white/30 transition-colors flex flex-col justify-between space-y-4"
            >
              <div className="flex items-start justify-between gap-3 font-sans">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {repo.private ? <Lock className="w-3.5 h-3.5 text-gray-400 shrink-0" /> : <Globe className="w-3.5 h-3.5 text-gray-400 shrink-0" />}
                    <span className="font-bold text-white text-base tracking-tight font-mono">{repo.fullName}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500 font-mono">
                    <span>Branch: <span className="text-gray-300 font-semibold">{repo.defaultBranch}</span></span>
                    <span>•</span>
                    <span className="px-1.5 py-0.5 rounded bg-white/5 text-gray-300 border border-white/10">{repo.language}</span>
                  </div>
                </div>
                {repo.issuesCount > 0 ? (
                  <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-white/5 text-[#ff5f56] border border-white/10">
                    {repo.issuesCount} Flaws
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-white/5 text-[#27c93f] border border-white/10">
                    Secure
                  </span>
                )}
              </div>

              <div className="pt-3 border-t border-white/10 flex items-center justify-between font-mono">
                <span className="text-xs text-gray-500">
                  {repo.lastScan ? `Scanned ${formatDistanceToNow(new Date(repo.lastScan), { addSuffix: true })}` : 'Ready'}
                </span>
                <button
                  onClick={() => handleScan(repo.fullName)}
                  disabled={!!scanningRepo}
                  className="inline-flex items-center gap-2 bg-white/5 hover:bg-white text-white hover:text-black px-4 py-2 rounded text-xs font-bold transition-colors border border-white/15 disabled:opacity-50"
                >
                  <Play className={`w-3.5 h-3.5 ${scanningRepo === repo.fullName ? 'animate-spin' : ''}`} />
                  {scanningRepo === repo.fullName ? 'Scanning...' : 'Scan Repository'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Reviews"
          value={stats?.totalReviews || 0}
          subtitle="PRs analyzed"
          icon={GitPullRequest}
        />
        <StatCard
          title="Issues Found"
          value={stats?.totalIssues || 0}
          subtitle="Total detected"
          icon={AlertTriangle}
        />
        <StatCard
          title="Avg Review Time"
          value={`${((stats?.avgReviewTime || 0) / 1000).toFixed(2)}s`}
          subtitle="Per PR analysis"
          icon={Clock}
        />
        <StatCard
          title="Detection Rate"
          value={stats?.totalReviews ? ((stats.totalIssues / stats.totalReviews)).toFixed(1) : 0}
          subtitle="Issues per review"
          icon={Shield}
        />
      </div>

      {/* Severity & Categories */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {stats && <SeverityBar stats={stats.issuesBySeverity} />}
        <div className="space-y-4">
          {stats && <CategoryGrid stats={stats.issuesByCategory} />}
        </div>
      </div>

      {/* Recent Reviews */}
      <RecentReviews reviews={reviews} />
    </div>
  )
}
