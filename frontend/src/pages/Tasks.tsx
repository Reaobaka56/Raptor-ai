import { useState, useEffect } from 'react'
import {
  Plus, Loader2, X, Bot, Cpu
} from 'lucide-react'
import { taskApi, agentApi, type AgentTask, type Agent } from '../api'
import { formatDistanceToNow } from 'date-fns'

const PRIORITY_COLORS = {
  0: 'text-red-400 bg-red-400/10 border-red-400/20', // Critical
  1: 'text-amber-400 bg-amber-400/10 border-amber-400/20', // High
  2: 'text-sky-400 bg-sky-400/10 border-sky-400/20', // Medium
  3: 'text-gray-400 bg-gray-400/10 border-gray-400/20', // Low
}
const PRIORITY_LABELS = { 0: 'P0', 1: 'P1', 2: 'P2', 3: 'P3' }

function TaskCard({ task, agents, onClick }: { task: AgentTask, agents: Agent[], onClick: () => void }) {
  const agent = agents.find(a => a.id === task.assigned_agent_id)
  const pColor = PRIORITY_COLORS[task.priority as keyof typeof PRIORITY_COLORS] || PRIORITY_COLORS[2]
  const pLabel = PRIORITY_LABELS[task.priority as keyof typeof PRIORITY_LABELS] || 'P2'

  return (
    <div 
      onClick={onClick}
      className="bg-[#111118] border border-white/5 rounded-lg p-4 cursor-pointer hover:border-white/20 transition group shadow-sm mb-3"
    >
      <div className="flex justify-between items-start mb-2">
        <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${pColor}`}>
          {pLabel}
        </span>
        {task.dependencies.length > 0 && (
          <span className="text-[10px] text-gray-500 font-mono" title="Has dependencies">
            {task.dependencies.length} deps
          </span>
        )}
      </div>
      <h4 className="text-sm font-bold text-white mb-2 line-clamp-2">{task.title}</h4>
      <div className="flex items-center justify-between mt-4">
        <div className="flex items-center gap-2">
          {agent ? (
            <div className="flex items-center gap-1.5" title={agent.name}>
              <div className="h-5 w-5 rounded bg-white/10 flex items-center justify-center text-[10px] text-white">
                {agent.name.charAt(0)}
              </div>
              <span className="text-xs text-gray-400 truncate max-w-[100px]">{agent.name}</span>
            </div>
          ) : (
            <span className="text-xs text-gray-500 italic">Unassigned</span>
          )}
        </div>
        <span className="text-[10px] text-gray-500">
          {formatDistanceToNow(new Date(task.updated_at), { addSuffix: true })}
        </span>
      </div>
    </div>
  )
}

function TaskColumn({ title, tasks, agents, onTaskClick }: { title: string, tasks: AgentTask[], agents: Agent[], onTaskClick: (t: AgentTask) => void }) {
  return (
    <div className="bg-black/50 border border-white/5 rounded-xl flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b border-white/5 flex items-center justify-between bg-black">
        <h3 className="font-bold text-white font-mono text-sm tracking-tight">{title}</h3>
        <span className="text-xs font-mono bg-white/10 text-gray-400 px-2 py-0.5 rounded-full">{tasks.length}</span>
      </div>
      <div className="p-3 overflow-y-auto flex-1 min-h-[500px]">
        {tasks.map(t => <TaskCard key={t.id} task={t} agents={agents} onClick={() => onTaskClick(t)} />)}
      </div>
    </div>
  )
}

function CreateTaskModal({ onClose, onSuccess, agents }: { onClose: () => void, onSuccess: () => void, agents: Agent[] }) {
  const [formData, setFormData] = useState<Partial<AgentTask>>({
    title: '', description: '', priority: 2, assigned_agent_id: '', dependencies: []
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await taskApi.create(formData)
      onSuccess()
    } catch (err) {
      console.error(err)
      alert("Failed to create task")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#0d0d14] overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8 bg-black/50">
          <h2 className="text-lg font-bold text-white font-mono">Create Task</h2>
          <button onClick={onClose} className="rounded border border-white/10 p-1.5 text-gray-500 hover:text-white hover:bg-white/5 transition">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5">
          <div>
            <label className="block text-xs font-bold font-mono text-gray-400 uppercase tracking-wider mb-2">Title</label>
            <input
              type="text" required
              value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})}
              placeholder="e.g. Implement login API"
              className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors font-sans"
            />
          </div>
          <div>
            <label className="block text-xs font-bold font-mono text-gray-400 uppercase tracking-wider mb-2">Description</label>
            <textarea
              rows={4}
              value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})}
              placeholder="Detailed requirements..."
              className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors font-sans resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold font-mono text-gray-400 uppercase tracking-wider mb-2">Priority</label>
              <select
                value={formData.priority} onChange={e => setFormData({...formData, priority: parseInt(e.target.value)})}
                className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors appearance-none font-sans"
              >
                <option value={0}>P0 - Critical</option>
                <option value={1}>P1 - High</option>
                <option value={2}>P2 - Medium</option>
                <option value={3}>P3 - Low</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold font-mono text-gray-400 uppercase tracking-wider mb-2">Assign Agent (Optional)</label>
              <select
                value={formData.assigned_agent_id || ''} onChange={e => setFormData({...formData, assigned_agent_id: e.target.value || undefined})}
                className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors appearance-none font-sans"
              >
                <option value="">Unassigned</option>
                {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>
          <div className="pt-4 flex justify-end gap-3 border-t border-white/10">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition">Cancel</button>
            <button type="submit" disabled={loading} className="px-5 py-2 bg-white text-black rounded-lg text-sm font-bold hover:bg-gray-200 transition disabled:opacity-50 flex items-center gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function TaskDetailModal({ task, agents, onClose, onUpdate }: { task: AgentTask, agents: Agent[], onClose: () => void, onUpdate: () => void }) {
  const [loading, setLoading] = useState(false)
  const [decomposeLoading, setDecomposeLoading] = useState(false)
  
  const handleStatusChange = async (status: string) => {
    setLoading(true)
    try {
      await taskApi.update(task.id, { status })
      onUpdate()
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleDecompose = async () => {
    setDecomposeLoading(true)
    try {
      await taskApi.update(task.id, { metadata: { ...task.metadata, decomposed: true } })
      // Simulate API call to AI for decomposition
      setTimeout(() => {
        onUpdate()
        setDecomposeLoading(false)
      }, 2000)
    } catch (e) {
      console.error(e)
      setDecomposeLoading(false)
    }
  }

  const agent = agents.find(a => a.id === task.assigned_agent_id)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl rounded-2xl border border-white/10 bg-[#0d0d14] overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8 bg-black/50">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-white font-mono">Task Detail</h2>
            <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${PRIORITY_COLORS[task.priority as keyof typeof PRIORITY_COLORS] || PRIORITY_COLORS[2]}`}>
              {PRIORITY_LABELS[task.priority as keyof typeof PRIORITY_LABELS] || 'P2'}
            </span>
          </div>
          <button onClick={onClose} className="rounded border border-white/10 p-1.5 text-gray-500 hover:text-white hover:bg-white/5 transition">
            <X className="h-4 w-4" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          <div>
            <h3 className="text-xl font-bold text-white mb-2">{task.title}</h3>
            <p className="text-gray-400 text-sm whitespace-pre-wrap">{task.description || 'No description provided.'}</p>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <label className="block text-[10px] font-bold font-mono text-gray-500 uppercase tracking-wider mb-2">Assignment</label>
              {agent ? (
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center text-white">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white font-mono">{agent.name}</p>
                    <p className="text-xs text-gray-500">{agent.role}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic">Unassigned</p>
              )}
            </div>
            
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
               <label className="block text-[10px] font-bold font-mono text-gray-500 uppercase tracking-wider mb-2">Status</label>
               <select
                value={task.status} onChange={e => handleStatusChange(e.target.value)}
                disabled={loading}
                className="w-full rounded-lg bg-black border border-white/10 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors font-sans"
              >
                <option value="backlog">Backlog</option>
                <option value="assigned">Assigned</option>
                <option value="in_progress">In Progress</option>
                <option value="review">Review</option>
                <option value="done">Done</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </div>
          
          <div className="bg-black border border-white/10 rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-bold text-white font-mono">Agent Workspace Output</h4>
              <button 
                onClick={handleDecompose}
                disabled={decomposeLoading}
                className="px-3 py-1.5 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded text-xs font-bold hover:bg-indigo-500/30 transition flex items-center gap-1.5"
              >
                {decomposeLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Cpu className="h-3 w-3" />}
                AI Decompose Task
              </button>
            </div>
            <div className="bg-[#0a0a0f] border border-white/5 rounded-lg p-3 font-mono text-xs text-gray-400 min-h-[100px] overflow-auto">
              {task.output || 'No output recorded yet.'}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Tasks() {
  const [tasks, setTasks] = useState<AgentTask[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [selectedTask, setSelectedTask] = useState<AgentTask | null>(null)

  const loadData = async () => {
    try {
      const [tRes, aRes] = await Promise.all([taskApi.list(), agentApi.list()])
      setTasks(tRes.data)
      setAgents(aRes.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const backlog = tasks.filter(t => t.status === 'backlog' || t.status === 'assigned')
  const inProgress = tasks.filter(t => t.status === 'in_progress')
  const review = tasks.filter(t => t.status === 'review')
  const done = tasks.filter(t => t.status === 'done' || t.status === 'failed')

  if (loading) return <div className="p-8 text-center text-gray-500"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 font-sans h-screen flex flex-col">
      <div className="flex items-center justify-between mb-6 flex-none">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">Task Board</h1>
          <p className="text-gray-400 mt-1">Orchestrate agent workloads and dependencies.</p>
        </div>
        <button 
          onClick={() => setShowCreate(true)}
          className="bg-white text-black px-4 py-2.5 rounded-lg text-sm font-bold hover:bg-gray-200 transition flex items-center gap-2"
        >
          <Plus className="h-4 w-4" /> New Task
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 flex-1 overflow-hidden min-h-0">
        <TaskColumn title="Backlog" tasks={backlog} agents={agents} onTaskClick={setSelectedTask} />
        <TaskColumn title="In Progress" tasks={inProgress} agents={agents} onTaskClick={setSelectedTask} />
        <TaskColumn title="Review" tasks={review} agents={agents} onTaskClick={setSelectedTask} />
        <TaskColumn title="Done" tasks={done} agents={agents} onTaskClick={setSelectedTask} />
      </div>

      {showCreate && (
        <CreateTaskModal 
          agents={agents}
          onClose={() => setShowCreate(false)} 
          onSuccess={() => { setShowCreate(false); loadData() }} 
        />
      )}

      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          agents={agents}
          onClose={() => setSelectedTask(null)}
          onUpdate={() => { loadData(); setSelectedTask(null) }}
        />
      )}
    </div>
  )
}
