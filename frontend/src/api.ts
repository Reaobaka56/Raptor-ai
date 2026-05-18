import axios from 'axios'

const api = axios.create({
// @ts-ignore
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export interface Review {
  id: number
  githubRepo: string
  prNumber: number
  prTitle: string | null
  prUrl: string | null
  issues: ReviewIssue[]
  summary: string | null
  status: string
  reviewTimeMs: number | null
  createdAt: string
}

export interface ReviewIssue {
  file: string
  line: number
  severity: 'critical' | 'high' | 'medium' | 'low'
  category: 'security' | 'performance' | 'quality' | 'design'
  title: string
  description: string
  suggestion: string
}

export interface Stats {
  totalReviews: number
  totalIssues: number
  avgReviewTime: number
  issuesBySeverity: {
    critical: number
    high: number
    medium: number
    low: number
  }
  issuesByCategory: {
    security: number
    performance: number
    quality: number
    design: number
  }
  reviewsOverTime: Array<{
    date: string
    count: number
    issues: number
  }>
}

export interface RepositoryInfo {
  id: string
  fullName: string
  private: boolean
  defaultBranch: string
  lastScan: string | null
  issuesCount: number
  language: string
}

export interface UserProfile {
  username: string
  avatarUrl: string
  githubId: number
}

export interface AuthResponse {
  token: string
  user: UserProfile
  repositories: RepositoryInfo[]
}

export const getGithubRedirectUri = () => `${window.location.origin}/auth/github/callback`

const isLocalDevelopment = () =>
  Boolean((import.meta as any).env?.DEV) && ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname)

export const startGithubLogin = async () => {
  if (isLocalDevelopment()) {
    const res = await api.post<AuthResponse>('/auth/github/dev-token')
    return res.data
  }

  const state = crypto.randomUUID()
  sessionStorage.setItem('github_oauth_state', state)
  const res = await api.get<{ url: string }>('/auth/github/login', {
    params: { state, redirectUri: getGithubRedirectUri() },
  })
  window.location.assign(res.data.url)
  return null
}

export const completeGithubLogin = (code: string) =>
  api.post<AuthResponse>('/auth/github', {
    code,
    redirectUri: getGithubRedirectUri(),
  })

export const authApi = {
  startGithubLogin,
  completeGithubLogin,
}

export const reposApi = {
  getRepos: () => api.get<RepositoryInfo[]>('/repos'),
  scanRepo: (repo: string) => api.post<Review>('/scan', { repo }),
}

export const prApi = {
  createPullRequest: (reviewId: number) => 
    api.post<{ status: string; prNumber: number; prUrl: string; message: string }>(`/reviews/${reviewId}/pull-request`),
}

export const reviewsApi = {
  getAll: (params?: { repo?: string; limit?: number; offset?: number }) =>
    api.get('/reviews', { params }),
  getById: (id: number) => api.get(`/reviews/${id}`),
}

export const statsApi = {
  getStats: (repo?: string) => api.get('/stats', { params: { repo } }),
}

export interface WebhookLogItem {
  id: string
  repo: string
  event: string
  status: number
  time: string
}

export interface ParserStatusItem {
  language: string
  version: string
  status: string
  cacheHits: string
}

export interface SystemTelemetry {
  cpuLoad: number
  astCacheRate: number
  queueBacklog: number
  memoryUsedGb: number
  memoryTotalGb: number
  uptimeSec: number
  parsers: ParserStatusItem[]
  webhookLogs: WebhookLogItem[]
}

export const telemetryApi = {
  getSystemTelemetry: () => api.get('/telemetry'),
}

export default api
