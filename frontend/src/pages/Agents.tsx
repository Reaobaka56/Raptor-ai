import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Bot, Plus, Play, Square, Pause, Settings, X, Loader2, Trash2
} from 'lucide-react'
import { agentApi, type Agent } from '../api'

const STATUS_COLORS: Record<string, string> = {
  idle: 'text-gray-400 bg-gray-400/10 border-gray-400/20',
  planning: 'text-indigo-400 bg-indigo-400/10 border-indigo-400/20',
  working: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
  waiting: 'text-sky-400 bg-sky-400/10 border-sky-400/20',
  reviewing: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
  completed: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  failed: 'text-red-400 bg-red-400/10 border-red-400/20',
  paused: 'text-zinc-400 bg-zinc-400/10 border-zinc-400/20',
}

const STATUS_DOT: Record<string, string> = {
  idle: 'bg-gray-400',
  planning: 'bg-indigo-400 animate-pulse',
  working: 'bg-amber-400 animate-pulse',
  waiting: 'bg-sky-400 animate-pulse',
  reviewing: 'bg-purple-400 animate-pulse',
  completed: 'bg-emerald-400',
  failed: 'bg-red-400',
  paused: 'bg-zinc-500',
}

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] || STATUS_COLORS.idle
  const dot = STATUS_DOT[status] || STATUS_DOT.idle
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${color}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

function AgentCard({ agent, onUpdateStatus, onDelete }: { agent: Agent, onUpdateStatus: (id: string, s: string) => void, onDelete: (id: string) => void }) {
  const isWorking = ['planning', 'working', 'reviewing'].includes(agent.status)
  
  return (
    <div className="bg-black border border-white/10 rounded-xl overflow-hidden hover:border-white/20 transition group">
      <div className="p-5">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white font-mono tracking-tight">{agent.name}</h3>
              <p className="text-xs text-gray-500 font-sans mt-0.5">{agent.role.replace('_', ' ').toUpperCase()}</p>
            </div>
          </div>
          <StatusBadge status={agent.status} />
        </div>
        
        <p className="text-sm text-gray-400 line-clamp-2 h-10 mb-4 font-sans">
          {agent.description || 'No description provided.'}
        </p>

        <div className="flex flex-wrap gap-2 mb-4">
          {agent.tools.slice(0, 3).map(t => (
            <span key={t} className="text-[10px] px-2 py-1 rounded bg-white/5 border border-white/5 text-gray-400 font-mono">
              {t}
            </span>
          ))}
          {agent.tools.length > 3 && (
            <span className="text-[10px] px-2 py-1 rounded bg-white/5 border border-white/5 text-gray-500 font-mono">
              +{agent.tools.length - 3}
            </span>
          )}
        </div>
      </div>
      
      <div className="px-5 py-3 bg-white/[0.02] border-t border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {agent.status === 'idle' && (
            <button onClick={() => onUpdateStatus(agent.id, 'working')} className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition" title="Start Agent">
              <Play className="h-4 w-4" />
            </button>
          )}
          {isWorking && (
            <button onClick={() => onUpdateStatus(agent.id, 'paused')} className="p-1.5 rounded hover:bg-white/10 text-amber-400 hover:text-amber-300 transition" title="Pause Agent">
              <Pause className="h-4 w-4" />
            </button>
          )}
          {(isWorking || agent.status === 'paused') && (
            <button onClick={() => onUpdateStatus(agent.id, 'idle')} className="p-1.5 rounded hover:bg-white/10 text-red-400 hover:text-red-300 transition" title="Stop Agent">
              <Square className="h-4 w-4" />
            </button>
          )}
          <Link to={`/agents/${agent.id}`} className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition" title="Agent Settings">
            <Settings className="h-4 w-4" />
          </Link>
        </div>
        <button onClick={() => onDelete(agent.id)} className="p-1.5 rounded hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition opacity-0 group-hover:opacity-100">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

function CreateAgentModal({ onClose, onSuccess, templates }: { onClose: () => void, onSuccess: () => void, templates: Record<string, any> }) {
  const [formData, setFormData] = useState({
    name: '', role: 'custom', description: '', system_prompt: '', model: 'gemini-2.5-pro'
  })
  const [loading, setLoading] = useState(false)

  const handleRoleChange = (role: string) => {
    const tpl = templates[role]
    if (tpl) {
      setFormData(prev => ({
        ...prev,
        role,
        name: prev.name || tpl.name,
        description: tpl.description,
        system_prompt: tpl.system_prompt
      }))
    } else {
      setFormData(prev => ({ ...prev, role }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const tools = templates[formData.role]?.tools || []
      const permissions = templates[formData.role]?.permissions || {}
      await agentApi.create({ ...formData, tools, permissions })
      onSuccess()
    } catch (err) {
      console.error(err)
      alert("Failed to create agent")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#0d0d14] overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8 bg-black/50">
          <h2 className="text-lg font-bold text-white font-mono">Create Agent</h2>
          <button onClick={onClose} className="rounded border border-white/10 p-1.5 text-gray-500 hover:text-white hover:bg-white/5 transition">
            <X className="h-4 w-4" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5">
          <div>
            <label className="block text-xs font-bold font-mono text-gray-400 uppercase tracking-wider mb-2">Template Role</label>
            <select
              value={formData.role}
              onChange={e => handleRoleChange(e.target.value)}
              className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors appearance-none font-sans"
            >
              <option value="custom">Custom Agent</option>
              {Object.keys(templates).map(k => (
                <option key={k} value={k}>{templates[k].name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold font-mono text-gray-400 uppercase tracking-wider mb-2">Agent Name</label>
            <input
              type="text" required
              value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
              placeholder="e.g. Frontend Wizard"
              className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors font-sans"
            />
          </div>
          
          <div>
            <label className="block text-xs font-bold font-mono text-gray-400 uppercase tracking-wider mb-2">Model</label>
            <select
              value={formData.model} onChange={e => setFormData({...formData, model: e.target.value})}
              className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors appearance-none font-sans"
            >
              <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
              <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
              <option value="claude-3-opus">Claude 3 Opus</option>
              <option value="gpt-4o">GPT-4o</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold font-mono text-gray-400 uppercase tracking-wider mb-2">Description</label>
            <textarea
              rows={2}
              value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})}
              className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors font-sans resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold font-mono text-gray-400 uppercase tracking-wider mb-2">System Prompt</label>
            <textarea
              rows={8} required
              value={formData.system_prompt} onChange={e => setFormData({...formData, system_prompt: e.target.value})}
              className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors font-mono resize-none leading-relaxed"
            />
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-white/10">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition">Cancel</button>
            <button type="submit" disabled={loading} className="px-5 py-2 bg-white text-black rounded-lg text-sm font-bold hover:bg-gray-200 transition disabled:opacity-50 flex items-center gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Agent'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Agents() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [templates, setTemplates] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  const loadData = async () => {
    try {
      const [agentsRes, tplRes] = await Promise.all([
        agentApi.list(),
        agentApi.getTemplates()
      ])
      setAgents(agentsRes.data)
      setTemplates(tplRes.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const updateStatus = async (id: string, status: string) => {
    try {
      await agentApi.updateStatus(id, status)
      loadData()
    } catch (err) {
      console.error(err)
      alert("Failed to update status")
    }
  }

  const deleteAgent = async (id: string) => {
    if (!confirm("Are you sure you want to delete this agent?")) return
    try {
      await agentApi.delete(id)
      loadData()
    } catch (err) {
      console.error(err)
    }
  }

  if (loading) return <div className="p-8 text-center text-gray-500"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 font-sans">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">Agents</h1>
          <p className="text-gray-400 mt-2">Manage your autonomous AI software engineering team.</p>
        </div>
        <button 
          onClick={() => setShowCreate(true)}
          className="bg-white text-black px-4 py-2.5 rounded-lg text-sm font-bold hover:bg-gray-200 transition flex items-center gap-2 shadow-sm"
        >
          <Plus className="h-4 w-4" /> Create Agent
        </button>
      </div>

      {agents.length === 0 ? (
        <div className="bg-black border border-white/10 rounded-xl p-12 text-center">
          <Bot className="h-12 w-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2 font-mono">No Agents Yet</h3>
          <p className="text-gray-400 mb-6 max-w-md mx-auto">Create specialized AI agents to help you write code, review pull requests, and manage projects.</p>
          <button 
            onClick={() => setShowCreate(true)}
            className="bg-white/10 border border-white/20 text-white px-6 py-2.5 rounded-lg text-sm font-bold hover:bg-white/20 transition inline-flex items-center gap-2"
          >
            <Plus className="h-4 w-4" /> Build Your First Agent
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {agents.map(agent => (
            <AgentCard 
              key={agent.id} 
              agent={agent} 
              onUpdateStatus={updateStatus}
              onDelete={deleteAgent}
            />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateAgentModal 
          templates={templates} 
          onClose={() => setShowCreate(false)} 
          onSuccess={() => { setShowCreate(false); loadData() }} 
        />
      )}
    </div>
  )
}
