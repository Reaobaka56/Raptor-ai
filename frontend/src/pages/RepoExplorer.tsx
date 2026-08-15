import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  Folder, ArrowLeft, ChevronRight, GitCommit,
  Loader2, AlertCircle, ExternalLink, Copy, Check, RefreshCw
} from 'lucide-react'
import { repoExplorerApi, type RepoTreeItem, type Commit, type CommitDetail } from '../api'
import { formatDistanceToNow } from 'date-fns'

const LANG_COLORS: Record<string, string> = {
  ts: '#3178c6', tsx: '#3178c6', js: '#f7df1e', jsx: '#f7df1e',
  py: '#3572A5', go: '#00ADD8', rs: '#dea584', java: '#b07219',
  rb: '#701516', css: '#563d7c', html: '#e34c26', md: '#083fa1',
  json: '#292929', yaml: '#cc1018', yml: '#cc1018', sh: '#89e051',
  sql: '#e38c00', env: '#555', gitignore: '#555',
}
function langColor(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  return LANG_COLORS[ext] || '#888'
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      className="rounded border border-white/10 p-1.5 text-gray-500 hover:text-white transition">
      {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
    </button>
  )
}

// ── File viewer ───────────────────────────────────────────────────────────────
function FileViewer({ owner, repo, path, onBack }: { owner: string; repo: string; path: string; onBack: () => void }) {
  const [content, setContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    repoExplorerApi.getFile(owner, repo, path)
      .then(r => setContent(r.data.content))
      .catch(() => setError('Failed to load file'))
      .finally(() => setLoading(false))
  }, [owner, repo, path])

  const lines = content?.split('\n') || []

  return (
    <div className="rounded-xl border border-white/10 bg-[#0d0d14] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 bg-black/30">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="text-gray-500 hover:text-white transition">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-mono text-gray-300">{path}</span>
          <span className="h-2 w-2 rounded-full flex-none" style={{ background: langColor(path) }} />
        </div>
        {content && <CopyButton text={content} />}
      </div>
      {loading && (
        <div className="flex items-center justify-center py-16 text-gray-600">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading file…
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 p-6 text-red-400 text-sm">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}
      {content !== null && !loading && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <tbody>
              {lines.map((line, i) => (
                <tr key={i} className="hover:bg-white/2">
                  <td className="select-none text-right pr-4 pl-4 py-0.5 text-gray-700 border-r border-white/5 w-12">{i + 1}</td>
                  <td className="pl-4 pr-4 py-0.5 text-gray-300 whitespace-pre">{line || ' '}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Commit detail ─────────────────────────────────────────────────────────────
function CommitDetailView({ owner, repo, sha, onBack }: { owner: string; repo: string; sha: string; onBack: () => void }) {
  const [detail, setDetail] = useState<CommitDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    repoExplorerApi.getCommitDetail(owner, repo, sha)
      .then(r => setDetail(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [sha])

  if (loading) return (
    <div className="flex items-center justify-center py-16 text-gray-600">
      <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading commit…
    </div>
  )

  if (!detail) return null

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="text-gray-500 hover:text-white transition">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-mono text-gray-400">Commit {detail.short_sha}</span>
      </div>
      <div className="rounded-xl border border-white/10 bg-[#0d0d14] p-5 space-y-3">
        <p className="font-semibold text-white">{detail.message.split('\n')[0]}</p>
        {detail.message.includes('\n') && (
          <p className="text-sm text-gray-500 whitespace-pre-wrap">{detail.message.split('\n').slice(1).join('\n').trim()}</p>
        )}
        <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 pt-2 border-t border-white/8">
          <div className="flex items-center gap-1.5">
            {detail.author.avatar_url && (
              <img src={detail.author.avatar_url} alt="" className="h-4 w-4 rounded-full" />
            )}
            <span>{detail.author.name}</span>
          </div>
          <span className="font-mono text-gray-600">{detail.sha.slice(0, 12)}</span>
          <span>{formatDistanceToNow(new Date(detail.date), { addSuffix: true })}</span>
          <span className="text-green-400">+{detail.stats?.additions || 0}</span>
          <span className="text-red-400">-{detail.stats?.deletions || 0}</span>
          <a href={detail.html_url} target="_blank" rel="noreferrer"
            className="flex items-center gap-1 hover:text-white transition ml-auto">
            View on GitHub <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
      <div className="space-y-2">
        {detail.files.map(f => (
          <div key={f.filename} className="rounded-xl border border-white/8 bg-[#0d0d14] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/6">
              <span className="text-xs font-mono text-gray-300">{f.filename}</span>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-green-400 font-mono">+{f.additions}</span>
                <span className="text-red-400 font-mono">-{f.deletions}</span>
              </div>
            </div>
            {f.patch && (
              <pre className="text-[11px] font-mono p-3 overflow-x-auto leading-relaxed max-h-64 overflow-y-auto">
                {f.patch.split('\n').map((line, i) => (
                  <div key={i} className={
                    line.startsWith('+') ? 'text-green-400 bg-green-500/8' :
                    line.startsWith('-') ? 'text-red-400 bg-red-500/8' :
                    line.startsWith('@@') ? 'text-indigo-400' : 'text-gray-500'
                  }>{line}</div>
                ))}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function RepoExplorer() {
  const { owner, repo } = useParams<{ owner: string; repo: string }>()
  // search params removed
  const [view, setView] = useState<'tree' | 'file' | 'commits' | 'commit-detail'>('tree')
  const [currentPath, setCurrentPath] = useState('')
  const [currentFile, setCurrentFile] = useState('')
  const [currentCommit, setCurrentCommit] = useState('')
  const [treeItems, setTreeItems] = useState<RepoTreeItem[]>([])
  const [commits, setCommits] = useState<Commit[]>([])
  const [branches, setBranches] = useState<{ name: string; sha: string }[]>([])
  const [branch, setBranch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [commitPage, setCommitPage] = useState(1)
  const [loadingMore, setLoadingMore] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [lastSynced, setLastSynced] = useState<Date | null>(null)

  if (!owner || !repo) return null

  const fetchTree = async (path = '', br = branch) => {
    setLoading(true)
    setError('')
    try {
      const res = await repoExplorerApi.getTree(owner, repo, path, br)
      if (res.data.type === 'directory') {
        setTreeItems(res.data.items || [])
        setCurrentPath(path)
        setView('tree')
      }
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Failed to load repository')
    } finally {
      setLoading(false)
    }
  }

  const fetchCommits = async (page = 1, append = false) => {
    if (page === 1) setLoading(true)
    else setLoadingMore(true)
    try {
      const res = await repoExplorerApi.getCommits(owner, repo, branch, '', page)
      if (append) setCommits(prev => [...prev, ...res.data])
      else setCommits(res.data)
      setCommitPage(page)
      setView('commits')
    } catch {
      setError('Failed to load commits')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  useEffect(() => {
    repoExplorerApi.getBranches(owner, repo)
      .then(r => { setBranches(r.data); if (r.data.length) setBranch(r.data[0].name) })
      .catch(() => {})
    fetchTree()
  }, [owner, repo])

  // Auto-sync: silently poll for new commits while the Commits tab is open
  const syncCommits = async () => {
    setSyncing(true)
    try {
      const res = await repoExplorerApi.getCommits(owner, repo, branch, '', 1)
      setCommits(prev => {
        const known = new Set(prev.map(c => c.sha))
        const fresh = res.data.filter(c => !known.has(c.sha))
        return fresh.length ? [...fresh, ...prev] : prev
      })
      setLastSynced(new Date())
    } catch {
      // silent — auto-sync failures shouldn't interrupt the user
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => {
    if (view !== 'commits') return
    setLastSynced(new Date())
    const interval = setInterval(syncCommits, 20000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, branch, owner, repo])

  const openFile = (path: string) => { setCurrentFile(path); setView('file') }
  const openCommit = (sha: string) => { setCurrentCommit(sha); setView('commit-detail') }

  // Breadcrumb
  const pathParts = currentPath ? currentPath.split('/') : []

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Link to="/dashboard" className="text-gray-500 hover:text-white transition">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-xl font-bold text-white font-mono">{owner}/{repo}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => fetchTree(currentPath)}
            className={`rounded border px-3 py-1.5 text-xs font-semibold transition ${view === 'tree' || view === 'file' ? 'border-white bg-white text-black' : 'border-white/10 text-gray-400 hover:text-white hover:border-white/30'}`}>
            Files
          </button>
          <button onClick={() => fetchCommits(1)}
            className={`rounded border px-3 py-1.5 text-xs font-semibold transition ${view === 'commits' || view === 'commit-detail' ? 'border-white bg-white text-black' : 'border-white/10 text-gray-400 hover:text-white hover:border-white/30'}`}>
            Commits
          </button>
          {(view === 'commits' || view === 'commit-detail') && (
            <span className="flex items-center gap-1.5 text-[11px] text-gray-600" title="Commits auto-sync every 20s">
              <RefreshCw className={`h-3 w-3 ${syncing ? 'animate-spin text-gray-400' : ''}`} />
              {syncing ? 'Syncing…' : lastSynced ? `Synced ${formatDistanceToNow(lastSynced, { addSuffix: true })}` : ''}
            </span>
          )}
          {branches.length > 0 && (
            <select value={branch}
              onChange={e => { setBranch(e.target.value); if (view === 'tree') fetchTree(currentPath, e.target.value) }}
              className="rounded border border-white/10 bg-black px-3 py-1.5 text-xs text-gray-400 font-mono focus:outline-none focus:border-white/30">
              {branches.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
            </select>
          )}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 text-gray-600">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-red-400 text-sm">
          <AlertCircle className="h-4 w-4 flex-none" /> {error}
        </div>
      )}

      {/* File tree view */}
      {!loading && view === 'tree' && (
        <div className="rounded-xl border border-white/10 bg-[#0d0d14] overflow-hidden">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1 px-4 py-3 border-b border-white/8 text-xs font-mono">
            <button onClick={() => fetchTree('')} className="text-indigo-400 hover:text-white transition">{repo}</button>
            {pathParts.map((part, i) => (
              <span key={i} className="flex items-center gap-1">
                <ChevronRight className="h-3 w-3 text-gray-600" />
                <button
                  onClick={() => fetchTree(pathParts.slice(0, i + 1).join('/'))}
                  className="text-indigo-400 hover:text-white transition">{part}</button>
              </span>
            ))}
          </div>
          {/* Items */}
          <div>
            {currentPath && (
              <button onClick={() => fetchTree(pathParts.slice(0, -1).join('/'))}
                className="flex w-full items-center gap-3 px-4 py-2.5 hover:bg-white/3 transition border-b border-white/5 text-gray-500 text-sm">
                <Folder className="h-4 w-4" /> ..
              </button>
            )}
            {treeItems.map(item => (
              <button key={item.path}
                onClick={() => item.type === 'dir' ? fetchTree(item.path) : openFile(item.path)}
                className="flex w-full items-center gap-3 px-4 py-2.5 hover:bg-white/3 transition border-b border-white/5 last:border-0 text-left">
                {item.type === 'dir'
                  ? <Folder className="h-4 w-4 text-indigo-400 flex-none" />
                  : <span className="h-2 w-2 rounded-full flex-none mt-0.5" style={{ background: langColor(item.name) }} />
                }
                <span className={`text-sm font-mono flex-1 min-w-0 truncate ${item.type === 'dir' ? 'text-indigo-300' : 'text-gray-300'}`}>
                  {item.name}
                </span>
                {item.type === 'file' && item.size > 0 && (
                  <span className="text-[10px] text-gray-700 font-mono flex-none">
                    {item.size < 1024 ? `${item.size}B` : `${(item.size / 1024).toFixed(1)}KB`}
                  </span>
                )}
              </button>
            ))}
            {treeItems.length === 0 && !loading && (
              <div className="py-8 text-center text-sm text-gray-600">This directory is empty</div>
            )}
          </div>
        </div>
      )}

      {/* File viewer */}
      {!loading && view === 'file' && (
        <FileViewer owner={owner} repo={repo} path={currentFile} onBack={() => setView('tree')} />
      )}

      {/* Commit list */}
      {!loading && view === 'commits' && (
        <div className="space-y-2">
          {commits.map(c => (
            <button key={c.sha} onClick={() => openCommit(c.sha)}
              className="flex w-full items-start gap-3 rounded-xl border border-white/8 bg-[#0d0d14] px-4 py-3.5 hover:border-white/20 transition text-left group">
              <GitCommit className="h-4 w-4 text-gray-600 mt-0.5 flex-none" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate group-hover:text-white">{c.message}</p>
                <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-600">
                  {c.author.avatar_url && <img src={c.author.avatar_url} alt="" className="h-3.5 w-3.5 rounded-full" />}
                  <span>{c.author.login || c.author.name}</span>
                  <span>{formatDistanceToNow(new Date(c.date), { addSuffix: true })}</span>
                  <span className="font-mono text-gray-700">{c.short_sha}</span>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-700 group-hover:text-gray-400 transition flex-none mt-0.5" />
            </button>
          ))}
          {commits.length === 0 && !loading && (
            <div className="text-center py-8 text-gray-600 text-sm">No commits found</div>
          )}
          {commits.length >= 30 && (
            <button onClick={() => fetchCommits(commitPage + 1, true)} disabled={loadingMore}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 py-3 text-sm text-gray-500 hover:text-white hover:border-white/30 transition">
              {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {loadingMore ? 'Loading…' : 'Load more commits'}
            </button>
          )}
        </div>
      )}

      {/* Commit detail */}
      {view === 'commit-detail' && (
        <CommitDetailView owner={owner} repo={repo} sha={currentCommit}
          onBack={() => setView('commits')} />
      )}
    </div>
  )
}
