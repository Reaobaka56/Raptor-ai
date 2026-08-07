import { useState, useEffect } from 'react'
import {
  Activity, Users, Terminal, MessageSquare, Loader2, RefreshCw, FileCode
} from 'lucide-react'
import { agentApi, taskApi, type Agent, type AgentTask, type AgentActivity } from '../api'
import { formatDistanceToNow } from 'date-fns'
import { Link } from 'react-router-dom'

function AgentStatusCard({ agent, currentTask }: { agent: Agent, currentTask?: AgentTask }) {
  const isWorking = ['working', 'planning', 'reviewing'].includes(agent.status)
  
  return (
    <div className="bg-black border border-white/10 rounded-xl p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white relative">
          <Terminal className="h-4 w-4" />
          <span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-black ${
            isWorking ? 'bg-green-500 animate-pulse' : 
            agent.status === 'failed' ? 'bg-red-500' : 'bg-gray-500'
          }`} />
        </div>
        <div>
          <h3 className="font-bold text-white text-sm">{agent.name}</h3>
          <p className="text-xs text-gray-500">{agent.role.replace('_', ' ')}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-xs font-mono font-bold text-gray-400 uppercase tracking-wider mb-1">Status</p>
        {isWorking ? (
          <div className="flex flex-col items-end">
            <span className="text-xs text-green-400 font-semibold flex items-center gap-1.5">
              <RefreshCw className="h-3 w-3 animate-spin" /> {agent.status}
            </span>
            {currentTask && (
              <span className="text-[10px] text-gray-500 truncate max-w-[150px] mt-0.5">
                {currentTask.title}
              </span>
            )}
          </div>
        ) : (
          <span className="text-xs text-gray-500 font-semibold">{agent.status}</span>
        )}
      </div>
    </div>
  )
}

function ActivityFeedItem({ activity }: { activity: AgentActivity }) {
  return (
    <div className="flex gap-3 p-3 hover:bg-white/[0.02] transition rounded-lg border border-transparent hover:border-white/5">
      <div className="mt-0.5 flex-none text-gray-500">
        <Activity className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-300">
          <span className="font-bold text-white mr-1">{activity.agent_id ? activity.agent_id.substring(0, 8) : 'System'}</span>
          {activity.description}
        </p>
        <span className="text-[10px] text-gray-500 mt-1 block">
          {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
        </span>
      </div>
    </div>
  )
}

export default function AgentDashboard() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [tasks, setTasks] = useState<AgentTask[]>([])
  const [activities, setActivities] = useState<AgentActivity[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    try {
      const [aRes, tRes] = await Promise.all([
        agentApi.list(),
        taskApi.list()
      ])
      setAgents(aRes.data)
      setTasks(tRes.data)
      
      // Load recent activities from the first few agents as a mock "global" feed for now
      // since we don't have a global activity endpoint yet.
      const activeAgents = aRes.data.filter(a => a.status !== 'idle').slice(0, 3)
      if (activeAgents.length > 0) {
        const actRes = await Promise.all(activeAgents.map(a => agentApi.getActivity(a.id, 5)))
        const allActs = actRes.flatMap(r => r.data).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        setActivities(allActs.slice(0, 15))
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    const iv = setInterval(loadData, 5000)
    return () => clearInterval(iv)
  }, [])

  if (loading && agents.length === 0) {
    return <div className="p-12 text-center text-gray-500"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
  }

  const activeAgents = agents.filter(a => ['working', 'planning', 'reviewing'].includes(a.status))
  
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress')

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 font-sans">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <Activity className="h-6 w-6 text-indigo-400" />
            Agent Activity
          </h1>
          <p className="text-gray-400 mt-2">Real-time overview of your autonomous AI engineering team.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/tasks" className="px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 text-white text-sm font-bold rounded-lg transition">
            View Task Board
          </Link>
          <Link to="/agents" className="px-4 py-2 bg-white text-black hover:bg-gray-200 text-sm font-bold rounded-lg transition">
            Manage Agents
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Team Status */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-5">
              <p className="text-xs font-bold font-mono text-indigo-400 uppercase tracking-wider mb-1">Active Agents</p>
              <p className="text-3xl font-black text-white font-mono">{activeAgents.length}</p>
            </div>
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-5">
              <p className="text-xs font-bold font-mono text-amber-400 uppercase tracking-wider mb-1">Active Tasks</p>
              <p className="text-3xl font-black text-white font-mono">{inProgressTasks.length}</p>
            </div>
            <div className="bg-gray-500/10 border border-gray-500/20 rounded-xl p-5">
              <p className="text-xs font-bold font-mono text-gray-400 uppercase tracking-wider mb-1">Total Agents</p>
              <p className="text-3xl font-black text-white font-mono">{agents.length}</p>
            </div>
          </div>

          <div className="bg-[#0a0a0f] border border-white/10 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-white/5 bg-black/50 flex items-center justify-between">
              <h2 className="font-bold text-white flex items-center gap-2">
                <Users className="h-4 w-4 text-gray-400" />
                Team Roster
              </h2>
            </div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              {agents.map(agent => (
                <AgentStatusCard 
                  key={agent.id} 
                  agent={agent} 
                  currentTask={tasks.find(t => t.id === agent.current_task_id)}
                />
              ))}
              {agents.length === 0 && (
                <div className="col-span-2 py-8 text-center text-gray-500">
                  No agents created yet.
                </div>
              )}
            </div>
          </div>
          
          {inProgressTasks.length > 0 && (
            <div className="bg-black border border-white/10 rounded-2xl p-5">
              <h2 className="font-bold text-white flex items-center gap-2 mb-4">
                <FileCode className="h-4 w-4 text-gray-400" />
                Current Active Tasks
              </h2>
              <div className="space-y-3">
                {inProgressTasks.map(task => {
                  const assignee = agents.find(a => a.id === task.assigned_agent_id)
                  return (
                    <div key={task.id} className="p-4 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-white mb-1">{task.title}</h4>
                        <p className="text-xs text-gray-400">Assigned to: {assignee ? assignee.name : 'Unknown'}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-amber-400 font-mono font-bold px-2 py-1 bg-amber-400/10 border border-amber-400/20 rounded-full flex items-center gap-1.5">
                          <RefreshCw className="h-3 w-3 animate-spin" /> In Progress
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Activity Feed */}
        <div className="bg-[#0a0a0f] border border-white/10 rounded-2xl flex flex-col h-[800px] overflow-hidden">
          <div className="p-4 border-b border-white/5 bg-black/50 flex items-center justify-between">
            <h2 className="font-bold text-white flex items-center gap-2">
              <Activity className="h-4 w-4 text-gray-400" />
              Activity Feed
            </h2>
            <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {activities.length > 0 ? (
              activities.map(act => <ActivityFeedItem key={act.id} activity={act} />)
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-6">
                <MessageSquare className="h-8 w-8 text-gray-700 mb-3" />
                <p className="text-gray-400 font-semibold">No recent activity</p>
                <p className="text-xs text-gray-600 mt-1">Agent actions will appear here in real-time.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
