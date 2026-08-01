import { useEffect, useState } from 'react'
import { KeyRound, Loader2, Trash2, Save } from 'lucide-react'
import { providerKeysApi, type ProviderKey } from '../api'

export default function SettingsPage() {
  const [keys, setKeys] = useState<ProviderKey[]>([])
  const [providers, setProviders] = useState<string[]>([])
  const [provider, setProvider] = useState('openai')
  const [apiKey, setApiKey] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const [p, k] = await Promise.all([providerKeysApi.providers(), providerKeysApi.list()])
      setProviders(p.data.providers); setProvider(p.data.providers[0] || 'openai'); setKeys(k.data)
    } finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])

  const save = async () => {
    setSaving(true); setMessage('')
    try { await providerKeysApi.save(provider, apiKey); setApiKey(''); setMessage('Key saved.'); await load() }
    catch (e: any) { setMessage(e.response?.data?.detail || 'Could not save key.') }
    finally { setSaving(false) }
  }
  const remove = async (p: string) => { await providerKeysApi.delete(p); await load() }

  return <div className="mx-auto max-w-3xl space-y-6">
    <div><h1 className="text-2xl font-bold text-white">Settings</h1><p className="text-sm text-gray-500">Manage provider credentials for Sandbox sessions.</p></div>
    <section className="rounded-2xl border border-white/10 bg-[#070707] p-4 sm:p-6 space-y-5">
      <div className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-gray-400"/><h2 className="font-semibold text-white">API Keys</h2></div>
      <div className="grid gap-3 sm:grid-cols-[180px_1fr_auto]">
        <select value={provider} onChange={e=>setProvider(e.target.value)} className="min-h-11 rounded-xl border border-white/10 bg-[#101010] px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/20">
          {providers.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <input value={apiKey} onChange={e=>setApiKey(e.target.value)} type="password" autoComplete="off" placeholder="Paste provider API key" className="min-h-11 rounded-xl border border-white/10 bg-[#101010] px-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-white/20" />
        <button onClick={save} disabled={saving || apiKey.length < 8} className="min-h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-black hover:bg-gray-200 disabled:opacity-50"><Save className="h-4 w-4"/>{saving?'Saving…':'Save'}</button>
      </div>
      {message && <p className="text-sm text-gray-400">{message}</p>}
      <div className="space-y-2">
        {loading ? <p className="text-sm text-gray-600"><Loader2 className="inline h-4 w-4 animate-spin"/> Loading…</p> : keys.map(k => <div key={k.id} className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-4 py-3">
          <div className="flex-1 min-w-0"><p className="text-sm font-medium text-white capitalize">{k.provider}</p><p className="font-mono text-xs text-gray-500">{k.key_mask} · configured</p></div>
          <button onClick={()=>remove(k.provider)} className="rounded-lg p-2 text-gray-500 hover:bg-red-500/10 hover:text-red-400"><Trash2 className="h-4 w-4"/></button>
        </div>)}
        {!loading && keys.length===0 && <p className="rounded-xl bg-white/[0.03] p-4 text-sm text-gray-500">No personal provider keys configured. Sandbox will use platform defaults.</p>}
      </div>
    </section>
  </div>
}
