import { useState, useEffect } from 'react'
import {
  Plus, Loader2
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

export default function Tasks() {
  const [tasks, setTasks] = useState<AgentTask[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)

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
        <button className="bg-white text-black px-4 py-2.5 rounded-lg text-sm font-bold hover:bg-gray-200 transition flex items-center gap-2">
          <Plus className="h-4 w-4" /> New Task
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 flex-1 overflow-hidden min-h-0">
        <TaskColumn title="Backlog" tasks={backlog} agents={agents} onTaskClick={() => {}} />
        <TaskColumn title="In Progress" tasks={inProgress} agents={agents} onTaskClick={() => {}} />
        <TaskColumn title="Review" tasks={review} agents={agents} onTaskClick={() => {}} />
        <TaskColumn title="Done" tasks={done} agents={agents} onTaskClick={() => {}} />
      </div>
    </div>
  )
}
