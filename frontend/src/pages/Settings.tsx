import { useState, useEffect } from 'react'
import { Key, Plus, Trash2, Eye, EyeOff, Loader2, AlertCircle, CheckCircle, Bot, Webhook, X, Shield } from 'lucide-react'
import api from '../api'
import { useNavigate } from 'react-router-dom'

interface ApiKey {
  id: string; provider: string; label: string; model?: string
  key_preview: string; is_active: boolean; created_at: string
}
interface Agent {
  id: string; name: string; description?: string; agent_type: string
  provider?: string; key_label?: string; model?: string
  webhook_url?: string; is_active: boolean; created_at: string
}
interface Provider { name: string; models: string[] }

const PROVIDER_ICONS: Record<string, string> = {
  openai: '🟢', anthropic: '🟣', gemini: '🔵', groq: '⚡', mistral: '🌊', custom: '⚙️'
}

function AddKeyForm({ providers, onSaved, onClose }: {
  providers: Record<string, Provider>; onSaved: (k: ApiKey) => void; onClose: () => void
}) {
  const [provider, setProvider] = useState('openai')
  const [label, setLabel] = useState('My Key')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    if (!apiKey.trim()) return
    setSaving(true); setError('')
    try {
      const res = await api.post('/keys', { provider, label, api_key: apiKey, model: model || undefined })
      onSaved(res.data)
    } catch (e: any) { setError(e.response?.data?.detail || 'Failed to save key') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0a0a10] p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white">Add API Key</h2>
          <button onClick={onClose} className="rounded border border-white/10 p-1.5 text-gray-500 hover:text-white transition"><X className="h-4 w-4"/></button>
        </div>
        <div>
          <label className="text-xs text-gray-600 mb-1 block">Provider</label>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(providers).map(([id, p]) => (
              <button key={id} onClick={() => { setProvider(id); setModel('') }}
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-semibold transition ${provider === id ? 'border-white bg-white/10 text-white' : 'border-white/10 text-gray-500 hover:text-gray-300'}`}>
                <span>{PROVIDER_ICONS[id]}</span> {p.name.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-600 mb-1 block">Label</label>
          <input value={label} onChange={e => setLabel(e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/4 px-3 py-2 text-sm text-white focus:outline-none focus:border-white/25"/>
        </div>
        <div>
          <label className="text-xs text-gray-600 mb-1 block">API Key</label>
          <div className="flex gap-2">
            <input type={showKey ? 'text' : 'password'} value={apiKey} onChange={e => setApiKey(e.target.value)}
              placeholder={`${providers[provider]?.name || provider} API key`}
              className="flex-1 rounded-lg border border-white/10 bg-white/4 px-3 py-2 text-sm text-white placeholder:text-gray-700 font-mono focus:outline-none focus:border-white/25"/>
            <button onClick={() => setShowKey(!showKey)} className="rounded-lg border border-white/10 px-3 text-gray-500 hover:text-white transition">
              {showKey ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}
            </button>
          </div>
        </div>
        {(providers[provider]?.models || []).length > 0 && (
          <div>
            <label className="text-xs text-gray-600 mb-1 block">Model</label>
            <select value={model} onChange={e => setModel(e.target.value)} className="w-full rounded-lg border border-white/10 bg-[#0a0a10] px-3 py-2 text-sm text-white focus:outline-none">
              <option value="">Default</option>
              {(providers[provider]?.models || []).map((m: string) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        )}
        {error && <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400"><AlertCircle className="h-3.5 w-3.5 flex-none"/>{error}</div>}
        <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/8 p-3">
          <p className="text-xs text-indigo-300/80"><Shield className="h-3 w-3 inline mr-1"/>Keys are encrypted at rest with AES-256. Never stored in plaintext.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={save} disabled={saving || !apiKey.trim()} className="flex items-center gap-2 rounded border border-white bg-white px-5 py-2 text-sm font-semibold text-black hover:bg-gray-100 disabled:opacity-50 transition">
            {saving ? <Loader2 className="h-4 w-4 animate-spin"/> : <Key className="h-4 w-4"/>}
            {saving ? 'Saving…' : 'Save Key'}
          </button>
          <button onClick={onClose} className="rounded border border-white/10 px-4 py-2 text-sm text-gray-400 hover:text-white transition">Cancel</button>
        </div>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<'keys' | 'agents'>('keys')
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [providers, setProviders] = useState<Record<string, Provider>>({})
  const [loading, setLoading] = useState(true)
  const [showAddKey, setShowAddKey] = useState(false)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, { valid: boolean }>>({})
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    if (!localStorage.getItem('token')) { navigate('/'); return }
    load()
  }, [])

  const load = async () => {
    setLoading(true)
    try {
      const [kr, ar, pr] = await Promise.all([api.get('/keys'), api.get('/keys/agents'), api.get('/keys/providers')])
      setKeys(kr.data); setAgents(ar.data); setProviders(pr.data)
    } catch {} finally { setLoading(false) }
  }

  const testKey = async (id: string) => {
    setTestingId(id)
    try { const r = await api.post(`/keys/${id}/test`); setTestResults(p => ({ ...p, [id]: r.data })) }
    catch { setTestResults(p => ({ ...p, [id]: { valid: false } })) }
    finally { setTestingId(null) }
  }

  const deleteKey = async (id: string) => {
    if (!confirm('Delete this API key?')) return
    setDeletingId(id)
    try { await api.delete(`/keys/${id}`); setKeys(p => p.filter(k => k.id !== id)) }
    catch {} finally { setDeletingId(null) }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {showAddKey && <AddKeyForm providers={providers} onSaved={k => { setKeys(p => [k, ...p]); setShowAddKey(false) }} onClose={() => setShowAddKey(false)}/>}

      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage AI provider keys and agent configurations.</p>
      </div>

      <div className="flex gap-1 border-b border-white/8">
        {(['keys', 'agents'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-semibold transition border-b-2 -mb-px capitalize ${tab === t ? 'border-white text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
            {t === 'keys' ? '🔑 API Keys' : '🤖 Agents'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-600"><Loader2 className="h-5 w-5 animate-spin mr-2"/>Loading…</div>
      ) : tab === 'keys' ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Add your own AI provider keys. Agents will use them for task execution.</p>
            <button onClick={() => setShowAddKey(true)} className="flex items-center gap-1.5 rounded border border-white/20 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white hover:text-black transition">
              <Plus className="h-3.5 w-3.5"/> Add Key
            </button>
          </div>
          {keys.length === 0 ? (
            <div className="text-center py-12 rounded-2xl border border-white/8 bg-[#0a0a10] space-y-3">
              <Key className="h-10 w-10 text-gray-700 mx-auto"/>
              <p className="text-gray-500 text-sm font-semibold">No API keys yet</p>
              <p className="text-gray-600 text-xs max-w-xs mx-auto">Add your OpenAI, Anthropic, or Gemini key. Agents will use your key instead of the platform default.</p>
              <button onClick={() => setShowAddKey(true)} className="inline-flex items-center gap-2 rounded border border-white/20 px-4 py-2 text-sm text-white hover:bg-white hover:text-black transition"><Plus className="h-4 w-4"/>Add first key</button>
            </div>
          ) : keys.map(k => {
            const result = testResults[k.id]
            return (
              <div key={k.id} className="rounded-2xl border border-white/10 bg-[#0a0a10] px-5 py-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-xl">{PROVIDER_ICONS[k.provider] || '🔑'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-white text-sm">{k.label}</p>
                      <span className="text-xs text-gray-600 capitalize">{k.provider}</span>
                      {k.model && <span className="text-[10px] font-mono text-gray-700 border border-white/8 rounded px-1.5 py-0.5">{k.model}</span>}
                    </div>
                    <p className="text-xs font-mono text-gray-600 mt-0.5">{k.key_preview}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {result && (
                      <span className={`flex items-center gap-1 text-xs font-semibold ${result.valid ? 'text-green-400' : 'text-red-400'}`}>
                        {result.valid ? <CheckCircle className="h-3.5 w-3.5"/> : <AlertCircle className="h-3.5 w-3.5"/>}
                        {result.valid ? 'Valid' : 'Invalid'}
                      </span>
                    )}
                    <button onClick={() => testKey(k.id)} disabled={testingId === k.id}
                      className="rounded border border-white/10 px-3 py-1.5 text-xs text-gray-400 hover:text-white hover:border-white/30 transition">
                      {testingId === k.id ? <Loader2 className="h-3 w-3 animate-spin"/> : 'Test'}
                    </button>
                    <button onClick={() => deleteKey(k.id)} disabled={deletingId === k.id}
                      className="rounded border border-red-500/20 p-1.5 text-red-400/60 hover:text-red-400 transition">
                      {deletingId === k.id ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <Trash2 className="h-3.5 w-3.5"/>}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="space-y-3">
          {agents.length === 0 ? (
            <div className="text-center py-12 rounded-2xl border border-white/8 bg-[#0a0a10] space-y-3">
              <Bot className="h-10 w-10 text-gray-700 mx-auto"/>
              <p className="text-gray-500 text-sm font-semibold">No agents configured</p>
              <p className="text-gray-600 text-xs">Create agents in the <a href="/agents" className="text-white hover:underline">Agents</a> page.</p>
            </div>
          ) : agents.map(a => (
            <div key={a.id} className="rounded-2xl border border-white/10 bg-[#0a0a10] px-5 py-4">
              <div className="flex items-center gap-3">
                <Bot className="h-5 w-5 text-gray-500"/>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white text-sm">{a.name}</p>
                  <div className="flex items-center gap-3 mt-0.5 text-[10px] text-gray-600 flex-wrap">
                    {a.provider && <span>{PROVIDER_ICONS[a.provider]} {a.key_label} ({a.provider}{a.model ? ` · ${a.model}` : ''})</span>}
                    {!a.provider && <span>Using platform default</span>}
                    {a.webhook_url && <span className="flex items-center gap-1"><Webhook className="h-3 w-3"/>webhook</span>}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
