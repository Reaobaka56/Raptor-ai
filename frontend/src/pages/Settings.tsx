import { useState, useEffect } from 'react'
import { Key, Plus, Trash2, Eye, EyeOff, Loader2, AlertCircle, CheckCircle, Shield, X } from 'lucide-react'
import { providerKeysApi, type ProviderKey } from '../api'
import { useNavigate } from 'react-router-dom'

const PROVIDER_ICONS: Record<string, string> = {
  openai: '🟢', anthropic: '🟣', gemini: '🔵', google: '🔵', groq: '⚡', mistral: '🌊', custom: '⚙️'
}

function AddKeyForm({ providers, onSaved, onClose }: {
  providers: string[]; onSaved: (k: ProviderKey) => void; onClose: () => void
}) {
  const [provider, setProvider] = useState(providers[0] || 'openai')
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    if (!apiKey.trim()) return
    setSaving(true); setError('')
    try {
      const res = await providerKeysApi.save(provider, apiKey)
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
            {providers.map((id) => (
              <button key={id} onClick={() => setProvider(id)}
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-semibold transition capitalize ${provider === id ? 'border-white bg-white/10 text-white' : 'border-white/10 text-gray-500 hover:text-gray-300'}`}>
                <span>{PROVIDER_ICONS[id] || '🔑'}</span> {id}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-600 mb-1 block">API Key</label>
          <div className="flex gap-2">
            <input type={showKey ? 'text' : 'password'} value={apiKey} onChange={e => setApiKey(e.target.value)}
              placeholder={`${provider} API key`}
              className="flex-1 rounded-lg border border-white/10 bg-white/4 px-3 py-2 text-sm text-white placeholder:text-gray-700 font-mono focus:outline-none focus:border-white/25"/>
            <button onClick={() => setShowKey(!showKey)} className="rounded-lg border border-white/10 px-3 text-gray-500 hover:text-white transition">
              {showKey ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}
            </button>
          </div>
        </div>
        {error && <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400"><AlertCircle className="h-3.5 w-3.5 flex-none"/>{error}</div>}
        <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/8 p-3">
          <p className="text-xs text-indigo-300/80"><Shield className="h-3 w-3 inline mr-1"/>Keys are encrypted at rest. Never stored in plaintext.</p>
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
  const [keys, setKeys] = useState<ProviderKey[]>([])
  const [providers, setProviders] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddKey, setShowAddKey] = useState(false)
  const [testingProvider, setTestingProvider] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; error?: string }>>({})
  const [deletingProvider, setDeletingProvider] = useState<string | null>(null)

  useEffect(() => {
    if (!localStorage.getItem('token')) { navigate('/'); return }
    load()
  }, [])

  const load = async () => {
    setLoading(true)
    try {
      const [kr, pr] = await Promise.all([providerKeysApi.list(), providerKeysApi.providers()])
      setKeys(kr.data); setProviders(pr.data.providers)
    } catch {} finally { setLoading(false) }
  }

  const testKey = async (provider: string) => {
    setTestingProvider(provider)
    try { const r = await providerKeysApi.test(provider); setTestResults(p => ({ ...p, [provider]: r.data })) }
    catch { setTestResults(p => ({ ...p, [provider]: { ok: false } })) }
    finally { setTestingProvider(null) }
  }

  const deleteKey = async (provider: string) => {
    if (!confirm('Delete this API key?')) return
    setDeletingProvider(provider)
    try { await providerKeysApi.delete(provider); setKeys(p => p.filter(k => k.provider !== provider)) }
    catch {} finally { setDeletingProvider(null) }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {showAddKey && <AddKeyForm providers={providers} onSaved={k => { setKeys(p => [k, ...p.filter(x => x.provider !== k.provider)]); setShowAddKey(false) }} onClose={() => setShowAddKey(false)}/>}

      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage your AI provider keys.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-600"><Loader2 className="h-5 w-5 animate-spin mr-2"/>Loading…</div>
      ) : (
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
            const result = testResults[k.provider]
            return (
              <div key={k.provider} className="rounded-2xl border border-white/10 bg-[#0a0a10] px-5 py-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-xl">{PROVIDER_ICONS[k.provider] || '🔑'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-white text-sm capitalize">{k.provider}</p>
                    </div>
                    <p className="text-xs font-mono text-gray-600 mt-0.5">{k.key_mask}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {result && (
                      <span className={`flex items-center gap-1 text-xs font-semibold ${result.ok ? 'text-green-400' : 'text-red-400'}`}>
                        {result.ok ? <CheckCircle className="h-3.5 w-3.5"/> : <AlertCircle className="h-3.5 w-3.5"/>}
                        {result.ok ? 'Valid' : (result.error || 'Invalid')}
                      </span>
                    )}
                    <button onClick={() => testKey(k.provider)} disabled={testingProvider === k.provider}
                      className="rounded border border-white/10 px-3 py-1.5 text-xs text-gray-400 hover:text-white hover:border-white/30 transition">
                      {testingProvider === k.provider ? <Loader2 className="h-3 w-3 animate-spin"/> : 'Test'}
                    </button>
                    <button onClick={() => deleteKey(k.provider)} disabled={deletingProvider === k.provider}
                      className="rounded border border-red-500/20 p-1.5 text-red-400/60 hover:text-red-400 transition">
                      {deletingProvider === k.provider ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <Trash2 className="h-3.5 w-3.5"/>}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
