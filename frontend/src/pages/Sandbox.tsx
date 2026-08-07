import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Terminal, Play, Square, Plus, Shield, AlertTriangle,
  ArrowLeft, Loader2, ChevronRight, Zap,
  Eye, X, KeyRound
} from 'lucide-react'
import api, { reposApi, providerKeysApi, type RepositoryInfo, type ProviderKey } from '../api'

interface SandboxSession {
  id: string; name: string; status: string; agent_type: string
  repo_url?: string; workspace_path?: string
  started_at?: string; ended_at?: string; created_at: string
  provider?: string; provider_key_source?: string
}

interface SandboxEvent {
  id: string; event_type: string; severity: string
  payload: Record<string, any>; created_at: string
}

interface ExecResult {
  stdout: string; stderr: string; exit_code: number
  blocked: boolean; duration_ms: number
}

const STATUS_COLORS: Record<string, string> = {
  running:  'text-green-400',
  starting: 'text-amber-400',
  stopped:  'text-gray-500',
  error:    'text-red-400',
  timeout:  'text-red-400',
}
const STATUS_DOT: Record<string, string> = {
  running:  'bg-green-400 animate-pulse',
  starting: 'bg-amber-400 animate-pulse',
  stopped:  'bg-gray-600',
  error:    'bg-red-400',
  timeout:  'bg-red-400',
}
const SEVERITY_COLORS: Record<string, string> = {
  info:     'text-gray-400',
  warning:  'text-amber-400',
  critical: 'text-red-400',
}
const EVENT_ICONS: Record<string, React.ReactNode> = {
  command:          <Terminal className="h-3 w-3" />,
  policy_violation: <Shield className="h-3 w-3 text-red-400" />,
  secret_access:    <AlertTriangle className="h-3 w-3 text-red-400" />,
  system:           <Zap className="h-3 w-3 text-indigo-400" />,
  network_request:  <Eye className="h-3 w-3" />,
}

const AGENT_TYPES = ['custom', 'cursor', 'claude-code', 'copilot', 'codex', 'devin']
const PROVIDERS = ['openai', 'anthropic', 'google', 'gemini', 'mistral', 'groq']

// ── Terminal component ────────────────────────────────────────────────────────
function SandboxTerminal({ sessionId }: { sessionId: string }) {
  const [history, setHistory] = useState<Array<{ cmd: string; result: ExecResult | null; pending: boolean }>>([])
  const [input, setInput] = useState('')
  const [executing, setExecuting] = useState(false)
  const [historyIdx, setHistoryIdx] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const cmdHistory = useRef<string[]>([])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [history])

  const run = async () => {
    if (!input.trim() || executing) return
    const cmd = input.trim()
    setInput('')
    setHistoryIdx(-1)
    cmdHistory.current = [cmd, ...cmdHistory.current.slice(0, 49)]
    setExecuting(true)
    const pending = { cmd, result: null, pending: true }
    setHistory(prev => [...prev, pending])
    try {
      const res = await api.post(`/sandbox/sessions/${sessionId}/execute`, { command: cmd, timeout: 30 })
      setHistory(prev => prev.map((h, i) => i === prev.length - 1 ? { ...h, result: res.data, pending: false } : h))
    } catch (e: any) {
      setHistory(prev => prev.map((h, i) => i === prev.length - 1 ? {
        ...h,
        result: { stdout: '', stderr: e.response?.data?.detail || 'Error', exit_code: 1, blocked: false, duration_ms: 0 },
        pending: false,
      } : h))
    } finally {
      setExecuting(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  return (
    <div className="flex flex-col h-full bg-black rounded-xl border border-white/10 overflow-hidden font-mono text-sm">
      {/* Terminal header */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-black border-b border-white/8">
        <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
        <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
        <span className="text-xs text-gray-600 ml-2">Raptor Sandbox — {sessionId.slice(0, 8)}</span>
      </div>

      {/* Output area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-[300px] max-h-[500px]">
        {history.length === 0 && (
          <div className="text-gray-700 text-xs space-y-1">
            <p className="text-green-400">Raptor Sandbox v1.0 — Isolated execution environment</p>
            <p>Type commands below. All activity is logged in the audit trail.</p>
            <p className="text-amber-400/70">⚠ Dangerous commands and secret access are blocked automatically.</p>
          </div>
        )}
        {history.map((item, i) => (
          <div key={i} className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-green-400 select-none">$</span>
              <span className="text-white">{item.cmd}</span>
              {item.pending && <Loader2 className="h-3 w-3 animate-spin text-gray-600" />}
            </div>
            {item.result && (
              <div className="pl-4 space-y-0.5">
                {item.result.blocked && (
                  <div className="flex items-center gap-1.5 text-red-400 text-xs">
                    <Shield className="h-3 w-3" /> Blocked by sandbox policy
                  </div>
                )}
                {item.result.stdout && (
                  <pre className="text-gray-300 text-xs whitespace-pre-wrap break-all leading-relaxed">
                    {item.result.stdout}
                  </pre>
                )}
                {item.result.stderr && (
                  <pre className={`text-xs whitespace-pre-wrap break-all leading-relaxed ${item.result.exit_code !== 0 ? 'text-red-400' : 'text-gray-500'}`}>
                    {item.result.stderr}
                  </pre>
                )}
                <span className="text-[10px] text-gray-700">
                  exit {item.result.exit_code} · {item.result.duration_ms}ms
                </span>
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-white/8 px-4 py-2.5 flex items-center gap-2 bg-black">
        <span className="text-green-400 select-none flex-none">$</span>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') { run(); return }
            if (e.key === 'ArrowUp') {
              const idx = Math.min(historyIdx + 1, cmdHistory.current.length - 1)
              setHistoryIdx(idx)
              setInput(cmdHistory.current[idx] || '')
            }
            if (e.key === 'ArrowDown') {
              const idx = Math.max(historyIdx - 1, -1)
              setHistoryIdx(idx)
              setInput(idx === -1 ? '' : cmdHistory.current[idx] || '')
            }
          }}
          placeholder="Type a command…"
          disabled={executing}
          autoFocus
          className="flex-1 bg-transparent text-white placeholder:text-gray-700 focus:outline-none text-sm"
        />
        {executing && <Loader2 className="h-4 w-4 animate-spin text-gray-600 flex-none" />}
      </div>
    </div>
  )
}

// ── Audit log ─────────────────────────────────────────────────────────────────
function AuditLog({ sessionId }: { sessionId: string }) {
  const [events, setEvents] = useState<SandboxEvent[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/sandbox/sessions/${sessionId}/events?limit=100`)
      setEvents(res.data)
    } catch {} finally { setLoading(false) }
  }, [sessionId])

  useEffect(() => {
    load()
    const iv = setInterval(load, 5000)
    return () => clearInterval(iv)
  }, [load])

  if (loading) return (
    <div className="flex items-center justify-center py-8 text-gray-600">
      <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading audit log…
    </div>
  )

  return (
    <div className="space-y-1 max-h-[500px] overflow-y-auto">
      {events.length === 0 && (
        <p className="text-center py-8 text-gray-600 text-sm">No events yet — run a command to start.</p>
      )}
      {events.map(e => (
        <div key={e.id} className={`flex items-start gap-2.5 rounded-lg px-3 py-2 ${e.severity === 'critical' ? 'bg-red-500/8 border border-red-500/20' : 'hover:bg-white/2'}`}>
          <span className={`mt-0.5 flex-none ${SEVERITY_COLORS[e.severity]}`}>
            {EVENT_ICONS[e.event_type] || <Terminal className="h-3 w-3" />}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs font-semibold ${SEVERITY_COLORS[e.severity]}`}>
                {e.event_type.replace('_', ' ')}
              </span>
              {e.severity !== 'info' && (
                <span className={`text-[10px] font-bold uppercase rounded px-1.5 py-0.5 ${
                  e.severity === 'critical' ? 'bg-red-500/15 text-red-400' : 'bg-amber-500/15 text-amber-400'
                }`}>{e.severity}</span>
              )}
              <span className="text-[10px] text-gray-700 ml-auto">
                {new Date(e.created_at).toLocaleTimeString()}
              </span>
            </div>
            {e.payload.command && (
              <p className="text-xs font-mono text-gray-400 truncate mt-0.5">{e.payload.command}</p>
            )}
            {e.payload.message && (
              <p className="text-xs text-gray-500 mt-0.5">{e.payload.message}</p>
            )}
            {e.payload.reason && (
              <p className="text-xs text-red-400/80 mt-0.5">{e.payload.reason}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Session detail ────────────────────────────────────────────────────────────
function SessionDetail({ session, onBack, onStop }: {
  session: SandboxSession; onBack: () => void; onStop: () => void
}) {
  const [stats, setStats] = useState<Record<string, number>>({})
  const [activeTab, setActiveTab] = useState<'terminal' | 'audit'>('terminal')
  const [stopping, setStopping] = useState(false)

  useEffect(() => {
    api.get(`/sandbox/sessions/${session.id}/stats`)
      .then(r => setStats(r.data)).catch(() => {})
    const iv = setInterval(() => {
      api.get(`/sandbox/sessions/${session.id}/stats`)
        .then(r => setStats(r.data)).catch(() => {})
    }, 10000)
    return () => clearInterval(iv)
  }, [session.id])

  const handleStop = async () => {
    setStopping(true)
    try {
      await api.delete(`/sandbox/sessions/${session.id}`)
      onStop()
    } catch {} finally { setStopping(false) }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={onBack} className="text-gray-500 hover:text-white transition">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full flex-none ${STATUS_DOT[session.status]}`} />
            <h2 className="text-lg font-bold text-white">{session.name}</h2>
          </div>
          <p className="text-xs font-mono text-gray-600">{session.id.slice(0, 16)}… · {session.agent_type}</p>
        </div>
        {session.status === 'running' && (
          <button onClick={handleStop} disabled={stopping}
            className="flex items-center gap-1.5 rounded border border-red-500/30 px-3 py-1.5 text-xs text-red-400 hover:border-red-400/60 transition">
            {stopping ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Square className="h-3.5 w-3.5" />}
            Stop
          </button>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Commands', value: stats.commands_run || 0, color: 'text-white' },
          { label: 'Violations', value: stats.policy_violations || 0, color: stats.policy_violations ? 'text-red-400' : 'text-white' },
          { label: 'Blocked', value: stats.secret_access_attempts || 0, color: stats.secret_access_attempts ? 'text-amber-400' : 'text-white' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-white/10 bg-black p-4 text-center">
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-gray-600 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/8 pb-0">
        {(['terminal', 'audit'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-semibold transition border-b-2 -mb-px ${
              activeTab === tab ? 'border-white text-white' : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}>
            {tab === 'terminal' ? 'Terminal' : 'Audit Log'}
          </button>
        ))}
      </div>

      {activeTab === 'terminal' ? (
        session.status === 'running'
          ? <SandboxTerminal sessionId={session.id} />
          : <div className="flex items-center justify-center py-16 text-gray-600 text-sm">Session is {session.status}</div>
      ) : (
        <AuditLog sessionId={session.id} />
      )}
    </div>
  )
}

// ── Create session modal ──────────────────────────────────────────────────────
function CreateModal({ onClose, onCreate }: { onClose: () => void, onCreate: (s: SandboxSession) => void }) {
  const [name, setName] = useState('New Session')
  const [agentType, setAgentType] = useState('custom')
  const [repoUrl, setRepoUrl] = useState('')
  const [repos, setRepos] = useState<RepositoryInfo[]>([])
  const [keys, setKeys] = useState<ProviderKey[]>([])
  const [creating, setCreating] = useState(false)
  const [provider, setProvider] = useState(PROVIDERS[0])
  const [keySource, setKeySource] = useState<'platform' | 'user'>('platform')
  const [repoError, setRepoError] = useState('')
  const [loadingRepos, setLoadingRepos] = useState(false)
  const [envVars, setEnvVars] = useState('{}')
  const [networkAllow, setNetworkAllow] = useState(true)

  useEffect(() => {
    const fetchReposAndKeys = async () => {
      setLoadingRepos(true)
      try {
        const [repoRes, keysRes] = await Promise.all([
          reposApi.getRepos(),
          providerKeysApi.list()
        ])
        setRepos(repoRes.data)
        setKeys(keysRes.data)
      } catch (e) {
        console.error(e)
      } finally {
        setLoadingRepos(false)
      }
    }
    fetchReposAndKeys()
  }, [])

  const validateRepo = () => {
    if (!repoUrl.trim()) { setRepoError(''); return true }
    const ok = /^https:\/\/(www\.)?github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/.test(repoUrl.trim())
    setRepoError(ok ? '' : 'Enter a valid GitHub repository URL, e.g. https://github.com/username/repository')
    return ok
  }

  const handleCreate = async () => {
    if (!validateRepo()) return
    setCreating(true)
    try {
      const res = await api.post('/sandbox/sessions', {
        name, agent_type: agentType,
        repo_url: repoUrl.trim() || undefined,
        provider, provider_key_source: keySource,
        environment_vars: JSON.parse(envVars || '{}'),
        network_policy: { allow: networkAllow }
      })
      onCreate(res.data)
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Failed to create session')
    } finally { setCreating(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-3xl border border-white/10 bg-[#050505] p-5 sm:p-6 space-y-5 shadow-[0_32px_80px_rgba(0,0,0,0.95)]">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white">New Sandbox Session</h2>
          <button onClick={onClose} className="rounded-full border border-white/5 bg-white/5 p-1.5 text-gray-500 hover:text-white transition">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-600 mb-1 block">Session name</label>
            <input value={name} onChange={e => setName(e.target.value)}
              className="w-full min-h-11 rounded-xl border border-white/10 bg-[#101010] px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/20" />
          </div>
          <div>
            <label className="text-xs text-gray-600 mb-1 block">Agent type</label>
            <select value={agentType} onChange={e => setAgentType(e.target.value)}
              className="w-full min-h-11 rounded-xl border border-white/10 bg-[#101010] px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/20">
              {AGENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">AI provider</label>
              <select value={provider} onChange={e => setProvider(e.target.value)} className="w-full min-h-11 rounded-xl border border-white/10 bg-[#101010] px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/20">
                {PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">API key source</label>
              <select value={keySource} onChange={e => setKeySource(e.target.value as 'platform' | 'user')} className="w-full min-h-11 rounded-xl border border-white/10 bg-[#101010] px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/20">
                <option value="platform">Platform default key</option>
                <option value="user" disabled={!keys.some(k => k.provider === provider)}>My {provider} key {keys.some(k => k.provider === provider) ? '' : '(not configured)'}</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Repository URL (optional)</label>
            {loadingRepos ? (
              <div className="flex items-center gap-2 text-xs text-gray-500 py-2">
                <Loader2 className="h-3 w-3 animate-spin" /> Loading repositories...
              </div>
            ) : (
              <>
                <input
                  value={repoUrl}
                  onChange={e => { setRepoUrl(e.target.value); if (repoError) setRepoError('') }}
                  onBlur={validateRepo}
                  list="sandbox-repositories"
                  placeholder="https://github.com/username/repository"
                  className="w-full min-h-11 rounded-xl border border-white/10 bg-[#101010] px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-white/20"
                />
                <datalist id="sandbox-repositories">
                  {repos.map(r => <option key={r.id} value={`https://github.com/${r.fullName}`}>{r.fullName}</option>)}
                </datalist>
                {repoError && <p className="mt-1 text-xs text-red-400">{repoError}</p>}
              </>
            )}
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Environment Variables (JSON)</label>
            <textarea
              value={envVars} onChange={e => setEnvVars(e.target.value)}
              className="w-full min-h-16 rounded-xl border border-white/10 bg-[#101010] px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-white/20 font-mono"
            />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="networkAllow" checked={networkAllow} onChange={e => setNetworkAllow(e.target.checked)} className="rounded border-white/10 bg-[#101010]" />
            <label htmlFor="networkAllow" className="text-xs text-gray-500">Allow Outbound Network Access</label>
          </div>
        </div>
        <div className="rounded-xl bg-white/[0.03] p-3 text-xs text-gray-500 flex gap-2"><KeyRound className="h-4 w-4 flex-none"/> This session will use the {keySource === 'user' ? 'personal masked provider key' : 'platform default provider key'}.</div>
        <div className="flex gap-3 pt-1">
          <button onClick={handleCreate} disabled={creating || !name.trim()}
            className="flex items-center gap-2 rounded border border-white bg-white px-5 py-2 text-sm font-semibold text-black hover:bg-neutral-200 disabled:opacity-50 transition">
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {creating ? 'Starting…' : 'Start Session'}
          </button>
          <button onClick={onClose} className="rounded border border-white/10 px-4 py-2 text-sm text-gray-400 hover:text-white transition">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SandboxPage() {
  const [sessions, setSessions] = useState<SandboxSession[]>([])
  const [selected, setSelected] = useState<SandboxSession | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    if (!localStorage.getItem('token')) { navigate('/'); return }
    load()
  }, [])

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.get('/sandbox/sessions')
      setSessions(res.data)
    } catch {} finally { setLoading(false) }
  }

  return (
    <div className="space-y-6">
      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreate={s => { setSessions(prev => [s, ...prev]); setSelected(s); setShowCreate(false) }}
        />
      )}

      {selected ? (
        <SessionDetail
          session={selected}
          onBack={() => { setSelected(null); load() }}
          onStop={() => { load(); setSelected(null) }}
        />
      ) : (
        <>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Agent Sandbox</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Minimal isolated workspaces for AI coding agents.
              </p>
            </div>
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 rounded border border-white bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-gray-100 transition">
              <Plus className="h-4 w-4" /> New Session
            </button>
          </div>

          {/* Sessions list */}
          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-600">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading sessions…
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-16 space-y-4 rounded-2xl border border-white/8 bg-black">
              <Terminal className="h-12 w-12 text-gray-700 mx-auto" />
              <p className="text-gray-400 font-semibold">No sessions yet</p>
              <p className="text-gray-600 text-sm max-w-xs mx-auto">
                Start a sandbox session to safely run your AI coding agent with full isolation and audit logging.
              </p>
              <button onClick={() => setShowCreate(true)}
                className="inline-flex items-center gap-2 rounded border border-white/20 px-4 py-2 text-sm text-white hover:bg-white hover:text-black transition">
                <Plus className="h-4 w-4" /> Start your first session
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.map(s => (
                <button key={s.id} onClick={() => setSelected(s)}
                  className="w-full text-left rounded-2xl border border-white/10 bg-black px-5 py-4 hover:border-white/25 transition group">
                  <div className="flex items-center gap-3">
                    <span className={`h-2 w-2 rounded-full flex-none ${STATUS_DOT[s.status]}`} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white">{s.name}</p>
                      <p className="text-xs font-mono text-gray-600 mt-0.5">
                        {s.agent_type} · {s.provider || 'default'} · {s.provider_key_source === 'user' ? 'BYOK' : 'platform'} · {s.id.slice(0, 8)}
                        {s.started_at && ` · started ${new Date(s.started_at).toLocaleTimeString()}`}
                      </p>
                    </div>
                    <span className={`text-xs font-mono capitalize ${STATUS_COLORS[s.status]}`}>{s.status}</span>
                    <ChevronRight className="h-4 w-4 text-gray-700 group-hover:text-gray-400 transition flex-none" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
