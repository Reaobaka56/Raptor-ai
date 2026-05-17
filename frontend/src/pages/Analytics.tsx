import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend
} from 'recharts'
import { 
  TrendingUp, 
  Calendar,
  BarChart3,
  PieChart as PieIcon
} from 'lucide-react'
import { statsApi, type Stats } from '../api'

const SEVERITY_COLORS = {
  critical: '#ff5f56',
  high: '#ffbd2e',
  medium: '#eab308',
  low: '#27c93f',
}

const CATEGORY_COLORS = {
  security: '#ff5f56',
  performance: '#ffbd2e',
  quality: '#eab308',
  design: '#3b82f6',
}

export default function Analytics() {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d')

  const { data: stats, isLoading } = useQuery({
    queryKey: ['stats-analytics'],
    queryFn: () => statsApi.getStats().then(r => r.data as Stats),
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 font-mono">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="bg-black border border-white/10 text-center py-20 space-y-4 font-mono max-w-md mx-auto mt-12 rounded-xl font-sans">
        <div className="w-12 h-12 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-white">
          <BarChart3 className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-white tracking-tight font-mono">No analytics recorded yet</h3>
        <p className="text-gray-400 text-sm font-sans max-w-sm mx-auto">Analytics metrics will populate once repository scans are completed.</p>
      </div>
    )
  }

  const severityData = [
    { name: 'Critical', value: stats.issuesBySeverity.critical, color: SEVERITY_COLORS.critical },
    { name: 'High', value: stats.issuesBySeverity.high, color: SEVERITY_COLORS.high },
    { name: 'Medium', value: stats.issuesBySeverity.medium, color: SEVERITY_COLORS.medium },
    { name: 'Low', value: stats.issuesBySeverity.low, color: SEVERITY_COLORS.low },
  ].filter(d => d.value > 0)

  const categoryData = [
    { name: 'Security', value: stats.issuesByCategory.security, color: CATEGORY_COLORS.security },
    { name: 'Performance', value: stats.issuesByCategory.performance, color: CATEGORY_COLORS.performance },
    { name: 'Quality', value: stats.issuesByCategory.quality, color: CATEGORY_COLORS.quality },
    { name: 'Design', value: stats.issuesByCategory.design, color: CATEGORY_COLORS.design },
  ].filter(d => d.value > 0)

  const timeData = stats.reviewsOverTime.map(d => ({
    date: d.date,
    reviews: d.count,
    issues: d.issues,
  }))

  return (
    <div className="space-y-8 font-sans pb-16 animate-fadeIn">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6 font-sans">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-wide font-mono">
            ANALYTICS & METRICS
          </h1>
          <p className="text-gray-400 mt-1 text-sm tracking-tight font-sans">AST execution statistics and vulnerability classifications</p>
        </div>

        {/* Time Filter Buttons */}
        <div className="flex items-center gap-1.5 bg-black border border-white/15 p-1 rounded-lg font-mono">
          {(['7d', '30d', '90d', 'all'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1.5 rounded text-xs font-bold transition-colors ${
                timeRange === range
                  ? 'bg-white text-black font-semibold'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {range === 'all' ? 'ALL TIME' : range.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 font-mono font-sans">
        <div className="bg-black border border-white/10 p-6 rounded-xl transition-colors hover:border-white/20">
          <div className="flex items-center gap-4 font-sans">
            <div className="p-3 bg-white/5 text-white border border-white/10 rounded-lg">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold font-mono">Total Scans</p>
              <p className="text-2xl font-bold text-white mt-1 tracking-tight font-mono">{stats.totalReviews}</p>
            </div>
          </div>
        </div>

        <div className="bg-black border border-white/10 p-6 rounded-xl transition-colors hover:border-white/20 font-sans">
          <div className="flex items-center gap-4 font-sans">
            <div className="p-3 bg-white/5 text-white border border-white/10 rounded-lg">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold font-mono">Total Flaws</p>
              <p className="text-2xl font-bold text-white mt-1 tracking-tight font-mono">{stats.totalIssues}</p>
            </div>
          </div>
        </div>

        <div className="bg-black border border-white/10 p-6 rounded-xl transition-colors hover:border-white/20 font-sans">
          <div className="flex items-center gap-4 font-sans">
            <div className="p-3 bg-white/5 text-white border border-white/10 rounded-lg">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold font-mono">Avg Analysis Speed</p>
              <p className="text-2xl font-bold text-white mt-1 tracking-tight font-mono">
                {(stats.avgReviewTime / 1000).toFixed(2)}s
              </p>
            </div>
          </div>
        </div>

        <div className="bg-black border border-white/10 p-6 rounded-xl transition-colors hover:border-white/20 font-sans">
          <div className="flex items-center gap-4 font-sans">
            <div className="p-3 bg-white/5 text-white border border-white/10 rounded-lg">
              <PieIcon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold font-mono">Flaws / Scan</p>
              <p className="text-2xl font-bold text-white mt-1 tracking-tight font-mono">
                {stats.totalReviews ? (stats.totalIssues / stats.totalReviews).toFixed(1) : '0'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 font-sans">
        {/* Scans Over Time Chart */}
        <div className="bg-black border border-white/10 p-6 rounded-xl font-sans">
          <h3 className="text-sm font-mono uppercase tracking-wider text-white mb-6 font-bold flex items-center gap-2 font-mono">
            <TrendingUp className="w-4 h-4 text-white" /> Execution & Detection History
          </h3>
          {timeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={timeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis 
                  dataKey="date" 
                  stroke="#888"
                  tick={{ fill: '#888', fontSize: 11 }}
                  tickFormatter={(val) => new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                />
                <YAxis stroke="#888" tick={{ fill: '#888', fontSize: 11 }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#000', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontFamily: 'monospace', fontSize: '12px' }}
                  itemStyle={{ color: '#fff' }}
                  labelFormatter={(val) => new Date(val).toLocaleDateString()}
                />
                <Legend wrapperStyle={{ fontFamily: 'monospace', fontSize: '12px', color: '#888' }} />
                <Line type="monotone" dataKey="reviews" stroke="#fff" strokeWidth={2} dot={{ fill: '#fff', r: 4 }} name="Scans Executed" />
                <Line type="monotone" dataKey="issues" stroke="#ff5f56" strokeWidth={2} dot={{ fill: '#ff5f56', r: 4 }} name="Flaws Detected" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-gray-500 font-mono text-sm">
              No historical data recorded
            </div>
          )}
        </div>

        {/* Severity Breakdown Pie Chart */}
        <div className="bg-black border border-white/10 p-6 rounded-xl font-sans">
          <h3 className="text-sm font-mono uppercase tracking-wider text-white mb-6 font-bold flex items-center gap-2 font-mono">
            <PieIcon className="w-4 h-4 text-white" /> Severity Classification
          </h3>
          {severityData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={severityData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={105}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {severityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#000', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontFamily: 'monospace', fontSize: '12px' }} itemStyle={{ color: '#fff' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-gray-500 font-mono text-sm">
              No severity records available
            </div>
          )}
        </div>

        {/* Category Breakdown Bar Chart */}
        <div className="bg-black border border-white/10 p-6 rounded-xl font-sans">
          <h3 className="text-sm font-mono uppercase tracking-wider text-white mb-6 font-bold flex items-center gap-2 font-mono">
            <BarChart3 className="w-4 h-4 text-white" /> Flaw Category Distribution
          </h3>
          {categoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={categoryData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis type="number" stroke="#888" tick={{ fill: '#888', fontSize: 11 }} />
                <YAxis dataKey="name" type="category" stroke="#888" tick={{ fill: '#888', fontSize: 11 }} width={90} />
                <Tooltip contentStyle={{ backgroundColor: '#000', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontFamily: 'monospace', fontSize: '12px' }} itemStyle={{ color: '#fff' }} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-gray-500 font-mono text-sm">
              No category records available
            </div>
          )}
        </div>

        {/* Severity Density Progress Bars Card */}
        <div className="bg-black border border-white/10 p-6 rounded-xl space-y-4 font-sans">
          <h3 className="text-sm font-mono uppercase tracking-wider text-white mb-6 font-bold flex items-center gap-2 font-mono">
            <TrendingUp className="w-4 h-4 text-white" /> Severity Density
          </h3>
          <div className="space-y-5 font-mono text-xs font-mono">
            {severityData.map((item) => (
              <div key={item.name} className="space-y-2">
                <div className="flex items-center justify-between font-sans">
                  <span className="font-bold text-white text-sm font-mono">{item.name}</span>
                  <span className="text-gray-400 font-mono font-semibold">{item.value} Flaws ({stats.totalIssues ? Math.round((item.value / stats.totalIssues) * 100) : 0}%)</span>
                </div>
                <div className="w-full bg-white/5 rounded-full h-2.5 border border-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${stats.totalIssues ? (item.value / stats.totalIssues) * 100 : 0}%`,
                      backgroundColor: item.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
