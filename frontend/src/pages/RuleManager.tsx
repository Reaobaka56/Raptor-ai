import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  BookOpen,
  Plus,
  Trash2,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Sparkles,
} from 'lucide-react'
import { memoryApi, type ConventionRule } from '../api'

export default function RuleManager() {
  const queryClient = useQueryClient()
  const [ruleText, setRuleText] = useState('')
  const [ruleRepo, setRuleRepo] = useState('*')
  const [addError, setAddError] = useState<string | null>(null)

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['convention-rules'],
    queryFn: () => memoryApi.getRules().then(r => r.data),
  })

  const addMutation = useMutation({
    mutationFn: () => memoryApi.addRule(ruleText, ruleRepo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['convention-rules'] })
      setRuleText('')
      setAddError(null)
    },
    onError: () => setAddError('Failed to add rule. Please try again.'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => memoryApi.deleteRule(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['convention-rules'] }),
  })

  const { data: feedbackStats } = useQuery({
    queryKey: ['feedback-stats'],
    queryFn: () => memoryApi.getFeedbackStats().then(r => r.data),
  })

  return (
    <div className="space-y-8 pb-16 animate-fadeIn">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-white/5 rounded-xl border border-white/10">
            <BookOpen className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white font-mono tracking-tight">
              Convention Rules
            </h1>
            <p className="text-gray-400 text-sm font-sans mt-0.5">
              Define your team's standards in plain English. Raptor will enforce them automatically.
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-black border border-white/10 rounded-xl p-5 space-y-1">
          <div className="flex items-center gap-2 text-xs text-gray-400 font-mono uppercase tracking-wider">
            <Shield className="w-3.5 h-3.5" /> Active Rules
          </div>
          <p className="text-2xl font-bold text-white font-mono">{rules.length}</p>
        </div>
        <div className="bg-black border border-white/10 rounded-xl p-5 space-y-1">
          <div className="flex items-center gap-2 text-xs text-gray-400 font-mono uppercase tracking-wider">
            <CheckCircle2 className="w-3.5 h-3.5" /> Feedback Collected
          </div>
          <p className="text-2xl font-bold text-white font-mono">{feedbackStats?.total ?? 0}</p>
        </div>
        <div className="bg-black border border-white/10 rounded-xl p-5 space-y-1">
          <div className="flex items-center gap-2 text-xs text-gray-400 font-mono uppercase tracking-wider">
            <AlertTriangle className="w-3.5 h-3.5" /> Suppression Rate
          </div>
          <p className="text-2xl font-bold text-white font-mono">
            {feedbackStats ? `${(feedbackStats.suppressionRate * 100).toFixed(0)}%` : '0%'}
          </p>
          <p className="text-[10px] text-gray-500 font-sans">False positives your team rejected</p>
        </div>
      </div>

      {/* Add Rule Form */}
      <div className="bg-black border border-white/10 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2 text-sm font-bold text-white font-mono uppercase tracking-wider">
          <Plus className="w-4 h-4" /> Add Convention Rule
        </div>
        <p className="text-xs text-gray-400 font-sans">
          Write your rule in plain English. Raptor will semantically match it against future code changes.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={ruleText}
            onChange={(e) => setRuleText(e.target.value)}
            placeholder='e.g. "We never use raw SQL queries — always use the ORM"'
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-500 font-sans focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20 transition-colors"
          />
          <select
            value={ruleRepo}
            onChange={(e) => setRuleRepo(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-gray-300 font-mono focus:outline-none focus:border-white/30 appearance-none cursor-pointer"
          >
            <option value="*">All repositories</option>
          </select>
          <button
            onClick={() => addMutation.mutate()}
            disabled={!ruleText.trim() || addMutation.isPending}
            className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black rounded-lg text-xs font-bold font-mono uppercase tracking-wider hover:bg-gray-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            {addMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {addMutation.isPending ? 'Embedding...' : 'Add Rule'}
          </button>
        </div>
        {addError && (
          <p className="text-xs text-red-400 font-mono">{addError}</p>
        )}
      </div>

      {/* Rules List */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
          Active Rules ({rules.length})
        </h2>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : rules.length === 0 ? (
          <div className="bg-black border border-white/10 rounded-xl text-center py-16 space-y-3">
            <div className="w-14 h-14 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center mx-auto">
              <BookOpen className="w-7 h-7 text-gray-500" />
            </div>
            <h3 className="text-lg font-bold text-white font-mono">No Rules Defined</h3>
            <p className="text-gray-400 text-sm font-sans max-w-md mx-auto">
              Add your first convention rule above. Raptor will learn to enforce it across all future scans.
            </p>
          </div>
        ) : (
          rules.map((rule: ConventionRule) => (
            <div
              key={rule.id}
              className="bg-black border border-white/10 rounded-xl p-5 flex items-start justify-between gap-4 group hover:border-white/20 transition-colors"
            >
              <div className="space-y-1.5 flex-1 min-w-0">
                <p className="text-sm text-white font-sans leading-relaxed">
                  "{rule.rule_text}"
                </p>
                <div className="flex items-center gap-3 text-[11px] text-gray-500 font-mono">
                  <span className="bg-white/5 px-2 py-0.5 rounded border border-white/10">
                    {rule.repo === '*' ? 'All repos' : rule.repo}
                  </span>
                  <span>Added {new Date(rule.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              <button
                onClick={() => deleteMutation.mutate(rule.id)}
                disabled={deleteMutation.isPending}
                className="p-2 text-gray-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100 border border-transparent hover:border-red-500/20"
                title="Delete rule"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
