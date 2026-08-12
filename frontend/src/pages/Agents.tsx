import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {Bot, Plus, Pause, Trash2, Edit2, Activity, Send,
  Loader2, X, Save, Code2, Shield, TestTube, Cpu,
  Database, FileText, Search, Zap, Users, Play, CheckCircle} from 'lucide-react'
import api from '../api'

interface Agent {
  id: string; name: string; role: string; description?: string
  system_prompt?: string; model: string; provider: string
  tools: string[]; permissions: Record<string,any>
  status: string; current_task_id?: string
  created_at: string; updated_at: string
}
interface Task {
  id: string; title: string; description?: string; priority: number
  status: string; assigned_agent_id?: string
  output?: string; created_at: string
}
interface Template {
  name: string; role: string; description: string
  system_prompt: string; tools: string[]; permissions: any
}

const ROLE_ICONS: Record<string, React.ReactNode> = {
  project_manager:   <Users className="h-4 w-4" />,
  ui_ux:             <Zap className="h-4 w-4" />,
  software_engineer: <Code2 className="h-4 w-4" />,
  qa_tester:         <TestTube className="h-4 w-4" />,
  security:          <Shield className="h-4 w-4" />,
  devops:            <Cpu className="h-4 w-4" />,
  database:          <Database className="h-4 w-4" />,
  documentation:     <FileText className="h-4 w-4" />,
  research:          <Search className="h-4 w-4" />,
  custom:            <Bot className="h-4 w-4" />,
}
const STATUS_DOT: Record<string, string> = {
  idle:       'bg-gray-600',
  planning:   'bg-blue-400 animate-pulse',
  working:    'bg-green-400 animate-pulse',
  waiting:    'bg-amber-400 animate-pulse',
  reviewing:  'bg-indigo-400 animate-pulse',
  completed:  'bg-green-300',
  failed:     'bg-red-400',
  paused:     'bg-gray-500',
}
const STATUS_TEXT: Record<string, string> = {
  idle:'text-gray-500', planning:'text-blue-400', working:'text-green-400',
  waiting:'text-amber-400', reviewing:'text-indigo-400', completed:'text-green-300',
  failed:'text-red-400', paused:'text-gray-400',
}
const PRIORITY_LABELS = ['Critical','High','Medium','Low']
const PRIORITY_COLORS = ['text-red-400','text-orange-400','text-amber-400','text-gray-500']
const TOOLS = ['file_read','file_write','command_exec','git_ops','network','install_deps','run_tests','lint','build']
const MODELS = ['gemini-2.5-pro','gemini-2.0-flash','gpt-4o','gpt-4o-mini','claude-sonnet-4-5','claude-haiku-4-5']

function AgentModal({ templates, agent, onSave, onClose }: {
  templates: Record<string,Template>; agent?: Agent|null
  onSave:(d:any)=>Promise<void>; onClose:()=>void
}) {
  const [name,setName]           = useState(agent?.name||'')
  const [role,setRole]           = useState(agent?.role||'custom')
  const [desc,setDesc]           = useState(agent?.description||'')
  const [prompt,setPrompt]       = useState(agent?.system_prompt||'')
  const [model,setModel]         = useState(agent?.model||'gemini-2.5-pro')
  const [tools,setTools]         = useState<string[]>(agent?.tools||[])
  const [saving,setSaving]       = useState(false)

  const apply = (t:Template) => { setName(t.name);setRole(t.role);setDesc(t.description);setPrompt(t.system_prompt);setTools(t.tools) }
  const toggle = (t:string) => setTools(p=>p.includes(t)?p.filter(x=>x!==t):[...p,t])

  const save = async () => {
    if(!name.trim()) return
    setSaving(true)
    await onSave({name,role,description:desc,system_prompt:prompt,model,tools})
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#080810] flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
          <h2 className="text-sm font-bold text-white">{agent?'Edit Agent':'New Agent'}</h2>
          <button onClick={onClose} className="rounded border border-white/10 p-1.5 text-gray-500 hover:text-white transition"><X className="h-4 w-4"/></button>
        </div>
        <div className="overflow-y-auto p-6 space-y-4 flex-1">
          {!agent && Object.keys(templates).length > 0 && (
            <div>
              <p className="text-[10px] font-mono uppercase tracking-widest text-gray-700 mb-2">Templates</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Object.entries(templates).map(([k,t])=>(
                  <button key={k} onClick={()=>apply(t)} className="flex items-center gap-2 rounded-lg border border-white/8 px-3 py-2 text-xs text-gray-500 hover:border-white/20 hover:text-white transition text-left">
                    {ROLE_ICONS[k]||<Bot className="h-3.5 w-3.5"/>}<span className="truncate">{t.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Name</label>
              <input value={name} onChange={e=>setName(e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/4 px-3 py-2 text-sm text-white focus:outline-none focus:border-white/25"/>
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Role</label>
              <select value={role} onChange={e=>setRole(e.target.value)} className="w-full rounded-lg border border-white/10 bg-[#080810] px-3 py-2 text-sm text-white focus:outline-none">
                {Object.keys(ROLE_ICONS).map(r=><option key={r} value={r}>{r.replace(/_/g,' ')}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-600 mb-1 block">Model</label>
            <select value={model} onChange={e=>setModel(e.target.value)} className="w-full rounded-lg border border-white/10 bg-[#080810] px-3 py-2 text-sm text-white focus:outline-none">
              {MODELS.map(m=><option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-600 mb-1 block">Description</label>
            <input value={desc} onChange={e=>setDesc(e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/4 px-3 py-2 text-sm text-white focus:outline-none focus:border-white/25"/>
          </div>
          <div>
            <label className="text-xs text-gray-600 mb-1 block">System Prompt</label>
            <textarea value={prompt} onChange={e=>setPrompt(e.target.value)} rows={6} className="w-full rounded-lg border border-white/10 bg-white/4 px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-white/25 resize-y leading-relaxed"/>
          </div>
          <div>
            <label className="text-xs text-gray-600 mb-2 block">Tools</label>
            <div className="flex flex-wrap gap-2">
              {TOOLS.map(t=>(
                <button key={t} onClick={()=>toggle(t)} className={`rounded px-2.5 py-1 text-xs font-mono transition ${tools.includes(t)?'bg-white text-black':'border border-white/10 text-gray-600 hover:text-gray-300'}`}>{t}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="border-t border-white/8 px-6 py-4 flex gap-3">
          <button onClick={save} disabled={saving||!name.trim()} className="flex items-center gap-2 rounded border border-white bg-white px-5 py-2 text-sm font-semibold text-black hover:bg-gray-100 disabled:opacity-50 transition">
            {saving?<Loader2 className="h-4 w-4 animate-spin"/>:<Save className="h-4 w-4"/>}
            {saving?'Saving…':'Save Agent'}
          </button>
          <button onClick={onClose} className="rounded border border-white/10 px-4 py-2 text-sm text-gray-500 hover:text-white transition">Cancel</button>
        </div>
      </div>
    </div>
  )
}

function TaskModal({ agents, onSave, onClose }: { agents:Agent[]; onSave:(d:any)=>Promise<void>; onClose:()=>void }) {
  const [title,setTitle]     = useState('')
  const [desc,setDesc]       = useState('')
  const [agentId,setAgentId] = useState('')
  const [priority,setPriority] = useState(2)
  const [context,setContext] = useState('')
  const [saving,setSaving]   = useState(false)

  const save = async () => {
    if(!title.trim()||!agentId) return
    setSaving(true)
    await onSave({title,description:desc,assigned_agent_id:agentId,priority,input_context:context})
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#080810] p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white">Assign Task</h2>
          <button onClick={onClose} className="rounded border border-white/10 p-1.5 text-gray-500 hover:text-white transition"><X className="h-4 w-4"/></button>
        </div>
        <div>
          <label className="text-xs text-gray-600 mb-1 block">Title</label>
          <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Redesign the dashboard" className="w-full rounded-lg border border-white/10 bg-white/4 px-3 py-2 text-sm text-white focus:outline-none focus:border-white/25"/>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-600 mb-1 block">Agent</label>
            <select value={agentId} onChange={e=>setAgentId(e.target.value)} className="w-full rounded-lg border border-white/10 bg-[#080810] px-3 py-2 text-sm text-white focus:outline-none">
              <option value="">Select…</option>
              {agents.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-600 mb-1 block">Priority</label>
            <select value={priority} onChange={e=>setPriority(Number(e.target.value))} className="w-full rounded-lg border border-white/10 bg-[#080810] px-3 py-2 text-sm text-white focus:outline-none">
              {PRIORITY_LABELS.map((l,i)=><option key={i} value={i}>{l}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-600 mb-1 block">Description</label>
          <textarea value={desc} onChange={e=>setDesc(e.target.value)} rows={3} placeholder="What should the agent do?" className="w-full rounded-lg border border-white/10 bg-white/4 px-3 py-2 text-sm text-white focus:outline-none focus:border-white/25 resize-none"/>
        </div>
        <div>
          <label className="text-xs text-gray-600 mb-1 block">Context (optional)</label>
          <textarea value={context} onChange={e=>setContext(e.target.value)} rows={2} placeholder="Relevant code or context…" className="w-full rounded-lg border border-white/10 bg-white/4 px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-white/25 resize-none"/>
        </div>
        <div className="flex gap-3 pt-1">
          <button onClick={save} disabled={saving||!title.trim()||!agentId} className="flex items-center gap-2 rounded border border-white bg-white px-5 py-2 text-sm font-semibold text-black hover:bg-gray-100 disabled:opacity-50 transition">
            {saving?<Loader2 className="h-4 w-4 animate-spin"/>:<Send className="h-4 w-4"/>}
            {saving?'Assigning…':'Assign'}
          </button>
          <button onClick={onClose} className="rounded border border-white/10 px-4 py-2 text-sm text-gray-500 hover:text-white transition">Cancel</button>
        </div>
      </div>
    </div>
  )
}

export default function AgentsPage() {
  const navigate  = useNavigate()
  const [agents,setAgents]       = useState<Agent[]>([])
  const [tasks,setTasks]         = useState<Task[]>([])
  const [templates,setTemplates] = useState<Record<string,Template>>({})
  const [selected,setSelected]   = useState<Agent|null>(null)
  const [showCreate,setShowCreate] = useState(false)
  const [editAgent,setEditAgent]   = useState<Agent|null>(null)
  const [showTask,setShowTask]     = useState(false)
  const [loading,setLoading]       = useState(true)
  const [tab,setTab]               = useState<'tasks'|'config'>('tasks')
  const poll = useRef<number>(0)

  useEffect(()=>{
    if(!localStorage.getItem('token')){navigate('/');return}
    load()
    api.get('/agents/templates').then(r=>setTemplates(r.data)).catch(()=>{})
    poll.current = window.setInterval(load, 8000)
    return ()=>clearInterval(poll.current)
  },[])

  const load = async () => {
    try {
      const [ar,tr] = await Promise.all([api.get('/agents'),api.get('/tasks')])
      setAgents(ar.data); setTasks(tr.data)
    } catch {} finally {setLoading(false)}
  }

  const createAgent = async (d:any) => { await api.post('/agents',d); await load(); setShowCreate(false) }
  const updateAgent = async (d:any) => { if(!editAgent)return; await api.patch(`/agents/${editAgent.id}`,d); await load(); setEditAgent(null) }
  const deleteAgent = async (id:string) => { if(!confirm('Delete this agent?'))return; await api.delete(`/agents/${id}`); if(selected?.id===id)setSelected(null); await load() }
  const setStatus  = async (a:Agent,s:string) => { await api.post(`/agents/${a.id}/status`,{status:s}); await load() }
  const createTask = async (d:any) => { await api.post('/tasks',d); await load(); setShowTask(false) }

  const agentTasks = selected ? tasks.filter(t=>t.assigned_agent_id===selected.id) : []

  return (
    <div className="space-y-4">
      {(showCreate||editAgent) && <AgentModal templates={templates} agent={editAgent} onSave={editAgent?updateAgent:createAgent} onClose={()=>{setShowCreate(false);setEditAgent(null)}}/>}
      {showTask && <TaskModal agents={agents} onSave={createTask} onClose={()=>setShowTask(false)}/>}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Agent Team</h1>
          <p className="text-xs text-gray-600">{agents.length} agents · {tasks.filter(t=>t.status==='in_progress').length} active</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={()=>setShowTask(true)} disabled={!agents.length} className="flex items-center gap-1.5 rounded border border-white/15 px-3 py-1.5 text-xs font-semibold text-gray-400 hover:text-white hover:border-white/30 transition disabled:opacity-40">
            <Send className="h-3.5 w-3.5"/> Assign Task
          </button>
          <button onClick={()=>setShowCreate(true)} className="flex items-center gap-1.5 rounded border border-white bg-white px-3 py-1.5 text-xs font-semibold text-black hover:bg-gray-100 transition">
            <Plus className="h-3.5 w-3.5"/> New Agent
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24 text-gray-600"><Loader2 className="h-5 w-5 animate-spin mr-2"/>Loading…</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Agent list */}
          <div className="space-y-2">
            {agents.length===0 ? (
              <div className="rounded-2xl border border-white/8 bg-[#080810] p-8 text-center space-y-3">
                <Bot className="h-10 w-10 text-gray-800 mx-auto"/>
                <p className="text-gray-600 text-sm">No agents yet</p>
                <p className="text-gray-700 text-xs max-w-xs mx-auto">Create specialized AI agents — each with their own role, model, tools, and system prompt.</p>
                <button onClick={()=>setShowCreate(true)} className="inline-flex items-center gap-2 rounded border border-white/15 px-4 py-2 text-xs text-white hover:bg-white hover:text-black transition">
                  <Plus className="h-3.5 w-3.5"/>Create first agent
                </button>
              </div>
            ) : agents.map(a=>(
              <div key={a.id} onClick={()=>setSelected(a)}
                className={`rounded-xl border cursor-pointer transition-all p-4 space-y-2.5 ${selected?.id===a.id?'border-white/25 bg-white/4':'border-white/8 bg-[#080810] hover:border-white/15'}`}>
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg border border-white/10 bg-white/4 flex items-center justify-center text-gray-500 flex-none">
                    {ROLE_ICONS[a.role]||<Bot className="h-4 w-4"/>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{a.name}</p>
                    <p className="text-xs text-gray-700 capitalize">{a.role.replace(/_/g,' ')}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-none">
                    <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[a.status]}`}/>
                    <span className={`text-[10px] capitalize ${STATUS_TEXT[a.status]}`}>{a.status}</span>
                  </div>
                </div>
                {a.description&&<p className="text-xs text-gray-700 line-clamp-1">{a.description}</p>}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-gray-800">{a.model}</span>
                  <div className="flex items-center gap-1" onClick={e=>e.stopPropagation()}>
                    {(a.status==='working'||a.status==='planning')&&(
                      <button onClick={()=>setStatus(a,'paused')} className="rounded p-1 text-gray-700 hover:text-amber-400 transition"><Pause className="h-3 w-3"/></button>
                    )}
                    {a.status==='paused'&&(
                      <button onClick={()=>setStatus(a,'idle')} className="rounded p-1 text-gray-700 hover:text-green-400 transition"><Play className="h-3 w-3"/></button>
                    )}
                    <button onClick={()=>{setEditAgent(a);setSelected(null)}} className="rounded p-1 text-gray-700 hover:text-white transition"><Edit2 className="h-3 w-3"/></button>
                    <button onClick={()=>deleteAgent(a.id)} className="rounded p-1 text-gray-700 hover:text-red-400 transition"><Trash2 className="h-3 w-3"/></button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Detail + tasks */}
          <div className="lg:col-span-2 space-y-4">
            {selected ? (
              <>
                {/* Agent header */}
                <div className="rounded-2xl border border-white/8 bg-[#080810] p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-10 w-10 rounded-xl border border-white/10 bg-white/4 flex items-center justify-center text-gray-400">
                      {ROLE_ICONS[selected.role]||<Bot className="h-5 w-5"/>}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-bold text-white">{selected.name}</h2>
                        <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[selected.status]}`}/>
                        <span className={`text-xs capitalize ${STATUS_TEXT[selected.status]}`}>{selected.status}</span>
                      </div>
                      <p className="text-xs text-gray-600">{selected.role.replace(/_/g,' ')} · {selected.model}</p>
                    </div>
                    <button onClick={()=>setSelected(null)} className="rounded border border-white/10 p-1.5 text-gray-600 hover:text-white transition"><X className="h-4 w-4"/></button>
                  </div>

                  <div className="flex gap-1 border-b border-white/8 -mb-5 pb-0">
                    {(['tasks','config'] as const).map(t=>(
                      <button key={t} onClick={()=>setTab(t)} className={`px-4 py-2 text-xs font-semibold transition border-b-2 -mb-px capitalize ${tab===t?'border-white text-white':'border-transparent text-gray-600 hover:text-gray-400'}`}>{t}</button>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/8 bg-[#080810] p-5">
                  {tab==='tasks' && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs text-gray-600">{agentTasks.length} task{agentTasks.length!==1?'s':''}</p>
                        <button onClick={()=>setShowTask(true)} className="text-xs text-white hover:underline flex items-center gap-1"><Plus className="h-3 w-3"/>Assign</button>
                      </div>
                      {agentTasks.length===0 ? (
                        <div className="text-center py-8 space-y-2">
                          <CheckCircle className="h-8 w-8 text-gray-800 mx-auto"/>
                          <p className="text-xs text-gray-700">No tasks assigned</p>
                        </div>
                      ) : agentTasks.map(t=>(
                        <div key={t.id} className="rounded-lg border border-white/8 bg-white/2 p-3 space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold text-white">{t.title}</p>
                            <div className="flex items-center gap-2 flex-none">
                              <span className={`text-[10px] font-semibold ${PRIORITY_COLORS[t.priority]}`}>{PRIORITY_LABELS[t.priority]}</span>
                              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                                t.status==='done'?'border-green-500/20 text-green-400':
                                t.status==='in_progress'?'border-blue-500/20 text-blue-400':
                                t.status==='failed'?'border-red-500/20 text-red-400':'border-white/10 text-gray-600'
                              }`}>{t.status}</span>
                            </div>
                          </div>
                          {t.description&&<p className="text-xs text-gray-600 line-clamp-2">{t.description}</p>}
                          {t.output&&<pre className="text-[11px] font-mono text-gray-500 bg-black/40 rounded p-2 whitespace-pre-wrap line-clamp-4">{t.output}</pre>}
                        </div>
                      ))}
                    </div>
                  )}
                  {tab==='config' && (
                    <div className="space-y-4">
                      {selected.description&&<div><p className="text-[10px] text-gray-700 uppercase tracking-wider font-mono mb-1">Description</p><p className="text-xs text-gray-400">{selected.description}</p></div>}
                      {selected.system_prompt&&<div><p className="text-[10px] text-gray-700 uppercase tracking-wider font-mono mb-1">System Prompt</p><pre className="text-xs text-gray-400 font-mono whitespace-pre-wrap leading-relaxed bg-black/40 rounded-lg p-3">{selected.system_prompt}</pre></div>}
                      <div><p className="text-[10px] text-gray-700 uppercase tracking-wider font-mono mb-2">Tools</p>
                        <div className="flex flex-wrap gap-1.5">
                          {selected.tools.map(t=><span key={t} className="rounded border border-white/10 px-2 py-0.5 text-[10px] font-mono text-gray-600">{t}</span>)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* All tasks view */
              <div className="rounded-2xl border border-white/8 bg-[#080810] p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-600">All Tasks ({tasks.length})</p>
                  {agents.length>0&&<button onClick={()=>setShowTask(true)} className="text-xs text-white hover:underline flex items-center gap-1"><Plus className="h-3 w-3"/>Assign Task</button>}
                </div>
                {tasks.length===0 ? (
                  <div className="text-center py-12 space-y-3">
                    <Activity className="h-10 w-10 text-gray-800 mx-auto"/>
                    <p className="text-gray-600 text-sm">No tasks yet</p>
                    {agents.length>0&&<button onClick={()=>setShowTask(true)} className="inline-flex items-center gap-2 rounded border border-white/15 px-4 py-2 text-xs text-white hover:bg-white hover:text-black transition"><Send className="h-3.5 w-3.5"/>Assign first task</button>}
                  </div>
                ) : tasks.map(t=>{
                  const agent = agents.find(a=>a.id===t.assigned_agent_id)
                  return (
                    <div key={t.id} className="rounded-lg border border-white/8 bg-white/2 p-3 space-y-1.5">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <p className="text-xs font-semibold text-white">{t.title}</p>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-semibold ${PRIORITY_COLORS[t.priority]}`}>{PRIORITY_LABELS[t.priority]}</span>
                          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                            t.status==='done'?'border-green-500/20 text-green-400':
                            t.status==='in_progress'?'border-blue-500/20 text-blue-400':
                            t.status==='failed'?'border-red-500/20 text-red-400':'border-white/10 text-gray-600'
                          }`}>{t.status}</span>
                        </div>
                      </div>
                      {agent&&<p className="text-[10px] text-gray-600 flex items-center gap-1">{ROLE_ICONS[agent.role]||<Bot className="h-3 w-3"/>}{agent.name}</p>}
                      {t.description&&<p className="text-xs text-gray-600 line-clamp-1">{t.description}</p>}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

