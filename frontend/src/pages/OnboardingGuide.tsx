import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BookOpen,
  Loader2,
  Search,
  Compass,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { memoryApi } from '../api'

export default function OnboardingGuide() {
  const [repoInput, setRepoInput] = useState('')
  const [activeRepo, setActiveRepo] = useState<string | null>(null)
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set([0, 1, 2, 3]))

  const { data: guide, isLoading, isError } = useQuery({
    queryKey: ['onboarding-guide', activeRepo],
    queryFn: () => memoryApi.getOnboardingGuide(activeRepo!).then(r => r.data),
    enabled: !!activeRepo,
  })

  const handleSearch = () => {
    if (repoInput.trim()) {
      setActiveRepo(repoInput.trim())
      setExpandedSections(new Set([0, 1, 2, 3]))
    }
  }

  const toggleSection = (index: number) => {
    setExpandedSections(prev => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  return (
    <div className="space-y-8 pb-16 animate-fadeIn">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-white/5 rounded-xl border border-white/10">
            <Compass className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white font-mono tracking-tight">
              Onboarding Guide
            </h1>
            <p className="text-gray-400 text-sm font-sans mt-0.5">
              Auto-generated repo guide: how auth works, recurring patterns, and known landmines.
            </p>
          </div>
        </div>
      </div>

      {/* Repo Search */}
      <div className="bg-black border border-white/10 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2 text-sm font-bold text-white font-mono uppercase tracking-wider">
          <Search className="w-4 h-4" /> Generate Guide for Repository
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={repoInput}
            onChange={(e) => setRepoInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="owner/repo (e.g. organization/api-gateway)"
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-500 font-mono focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20 transition-colors"
          />
          <button
            onClick={handleSearch}
            disabled={!repoInput.trim() || isLoading}
            className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black rounded-lg text-xs font-bold font-mono uppercase tracking-wider hover:bg-gray-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Compass className="w-4 h-4" />
            )}
            {isLoading ? 'Generating...' : 'Generate'}
          </button>
        </div>
      </div>

      {/* Guide Content */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          <p className="text-sm text-gray-400 font-sans">Analyzing repository history and conventions...</p>
        </div>
      )}

      {isError && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 text-center">
          <p className="text-red-400 font-mono text-sm">Failed to generate guide. Make sure the repository exists and has scan history.</p>
        </div>
      )}

      {guide && (
        <div className="space-y-4">
          {/* Guide Header */}
          <div className="bg-black border border-white/10 rounded-xl p-6 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <BookOpen className="w-5 h-5 text-white" />
                <h2 className="text-lg font-bold text-white font-mono tracking-tight">
                  {guide.repo}
                </h2>
              </div>
              <span className="text-[11px] text-gray-500 font-mono">
                Generated {new Date(guide.generatedAt).toLocaleString()}
              </span>
            </div>
            <p className="text-xs text-gray-400 font-sans">
              This guide is auto-generated from Raptor's scan history, team conventions, and feedback data.
              It updates as your team uses the platform.
            </p>
          </div>

          {/* Sections */}
          {guide.sections.map((section, idx) => {
            const isExpanded = expandedSections.has(idx)
            return (
              <div
                key={idx}
                className="bg-black border border-white/10 rounded-xl overflow-hidden transition-colors hover:border-white/15"
              >
                <button
                  onClick={() => toggleSection(idx)}
                  className="w-full flex items-center justify-between p-5 text-left"
                >
                  <h3 className="text-sm font-bold text-white font-mono tracking-tight">
                    {section.title}
                  </h3>
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                  )}
                </button>
                {isExpanded && (
                  <div className="px-5 pb-5 space-y-2 border-t border-white/5 pt-4 animate-fadeIn">
                    {section.content.map((item, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2.5 text-sm text-gray-300 font-sans leading-relaxed"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-white/30 mt-2 shrink-0" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Empty State */}
      {!guide && !isLoading && !isError && (
        <div className="bg-black border border-white/10 rounded-xl text-center py-20 space-y-4">
          <div className="w-16 h-16 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center mx-auto">
            <Compass className="w-8 h-8 text-gray-500" />
          </div>
          <h3 className="text-lg font-bold text-white font-mono tracking-tight">
            Generate Your First Onboarding Guide
          </h3>
          <p className="text-gray-400 text-sm font-sans max-w-lg mx-auto">
            Enter a repository name above to generate a comprehensive onboarding guide based on
            Raptor's scan history, your team's conventions, and feedback patterns.
          </p>
        </div>
      )}
    </div>
  )
}
