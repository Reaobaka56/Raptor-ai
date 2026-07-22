import axios from 'axios'

const DEFAULT_PRODUCTION_API_URL = 'https://raptor-ai.onrender.com/api'

const normalizeApiBaseUrl = (url: string) => {
  const trimmedUrl = url.trim().replace(/\/$/, '')
  if (!trimmedUrl || trimmedUrl === '/api' || trimmedUrl.endsWith('/api')) {
    return trimmedUrl || '/api'
  }
  return `${trimmedUrl}/api`
}

const getApiBaseUrl = () => {
  const envApiUrl = import.meta.env.VITE_API_URL
  if (envApiUrl) return normalizeApiBaseUrl(envApiUrl)
  if (import.meta.env.PROD) return DEFAULT_PRODUCTION_API_URL
  return '/api'
}

const api = axios.create({
  baseURL: getApiBaseUrl(),
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ReviewIssue {
  file: string; line: number
  severity: 'critical' | 'high' | 'medium' | 'low'
  category: 'security' | 'performance' | 'quality' | 'design'
  title: string; description: string; suggestion: string
}

export interface Review {
  id: number; githubRepo: string; prNumber: number
  prTitle: string | null; prUrl: string | null
  fixPrNumber: number | null; fixPrUrl: string | null
  issues: ReviewIssue[]; summary: string | null
  status: string; reviewTimeMs: number | null; createdAt: string
}

export interface Stats {
  totalReviews: number; totalIssues: number; avgReviewTime: number
  issuesBySeverity: { critical: number; high: number; medium: number; low: number }
  issuesByCategory: { security: number; performance: number; quality: number; design: number }
  reviewsOverTime: Array<{ date: string; count: number; issues: number }>
}

export interface RepositoryInfo {
  id: string; fullName: string; private: boolean
  defaultBranch: string; lastScan: string | null
  issuesCount: number; language: string
}

export interface UserProfile {
  id?: string; username: string; avatarUrl: string
  githubId: number; role?: string; name?: string; email?: string
}

export interface AuthResponse {
  token: string; user: UserProfile; repositories: RepositoryInfo[]
}

// ── Blog types ─────────────────────────────────────────────────────────────────

export interface BlogPost {
  id: string; slug: string; title: string; summary: string | null
  content: string; category: string; featured_image: string | null
  published: boolean; published_at: string | null; created_at: string
  author_username?: string; author_avatar?: string
}

// ── Team types ─────────────────────────────────────────────────────────────────

export interface Team {
  id: string; name: string; slug: string; owner_id: string
  created_at: string; role?: string
}

export interface TeamMember {
  id: string; username: string; name: string | null
  avatar_url: string | null; role: string; joined_at: string
}

export interface Invitation {
  id: string; team_id: string; invite_token: string
  invitee_email: string | null; invitee_github: string | null
  role: string; status: string; expires_at: string; created_at: string
  team_name?: string; invited_by_username?: string
}

// ── Auth ───────────────────────────────────────────────────────────────────────

export const getGithubRedirectUri = () => {
  const envRedirect = import.meta.env.VITE_GITHUB_REDIRECT_URI as string | undefined
  if (envRedirect && envRedirect.length > 0) return envRedirect
  return `${window.location.origin}/api/auth/github/callback`
}

export const startGithubLogin = async () => {
  const state = crypto.randomUUID()
  sessionStorage.setItem('github_oauth_state', state)
  const res = await api.get<{ url: string }>('/auth/github/login', {
    params: { state, redirectUri: getGithubRedirectUri() },
  })
  window.location.assign(res.data.url)
}

export const completeGithubLogin = (code: string, state?: string) =>
  api.post<AuthResponse>('/auth/github', { code, state, redirectUri: getGithubRedirectUri() })

export const authApi = { startGithubLogin, completeGithubLogin }

// ── Users ──────────────────────────────────────────────────────────────────────

export const userApi = {
  getMe: () => api.get<UserProfile>('/users/me'),
  isAdmin: () => api.get<{ isAdmin: boolean }>('/users/me/is-admin'),
}

// ── Blog ───────────────────────────────────────────────────────────────────────

export const blogApi = {
  list: () => api.get<BlogPost[]>('/blog'),
  get: (slug: string) => api.get<BlogPost>(`/blog/${slug}`),
  create: (data: Partial<BlogPost>) => api.post<BlogPost>('/blog', data),
  update: (slug: string, data: Partial<BlogPost>) => api.patch<BlogPost>(`/blog/${slug}`, data),
  delete: (slug: string) => api.delete(`/blog/${slug}`),
}

// ── Teams ──────────────────────────────────────────────────────────────────────

export const teamsApi = {
  list: () => api.get<Team[]>('/teams'),
  create: (name: string) => api.post<Team>('/teams', { name }),
  get: (id: string) => api.get<Team & { members: TeamMember[] }>(`/teams/${id}`),
  addMember: (teamId: string, username: string, role = 'member') =>
    api.post(`/teams/${teamId}/members`, { username, role }),
  removeMember: (teamId: string, username: string) =>
    api.delete(`/teams/${teamId}/members/${username}`),
  invite: (teamId: string, data: { invitee_email?: string; invitee_github?: string; role?: string }) =>
    api.post<Invitation>(`/teams/${teamId}/invitations`, data),
  getInvitation: (token: string) => api.get<Invitation>(`/teams/invitations/${token}`),
  acceptInvitation: (token: string) => api.post(`/teams/invitations/${token}/accept`),
}

// ── Existing APIs ──────────────────────────────────────────────────────────────

export const reposApi = {
  getRepos: () => api.get<RepositoryInfo[]>('/repos'),
  scanRepo: (repo: string) => api.post<Review>('/scan', { repo }),
}

export const reviewsApi = {
  getAll: (params?: { repo?: string; limit?: number; offset?: number }) =>
    api.get('/reviews', { params }),
  getById: (id: number) => api.get(`/reviews/${id}`),
}

export const statsApi = {
  getStats: (repo?: string) => api.get('/stats', { params: { repo } }),
}

export const telemetryApi = {
  getSystemTelemetry: () => api.get('/telemetry'),
}

export interface ConventionRule {
  id: number; repo: string; org: string; rule_text: string
  enabled: boolean; created_at: string
}

export const memoryApi = {
  addRule: (rule_text: string, repo = '*', org = '*') =>
    api.post<ConventionRule>('/memory/rules', { rule_text, repo, org }),
  getRules: (repo = '*') => api.get<ConventionRule[]>('/memory/rules', { params: { repo } }),
  deleteRule: (ruleId: number) => api.delete(`/memory/rules/${ruleId}`),
  submitFeedback: (review_id: number, issue_index: number, thumbs_up: boolean, comment?: string) =>
    api.post('/memory/feedback', { review_id, issue_index, thumbs_up, comment }),
  getReviewFeedback: (reviewId: number) => api.get(`/memory/feedback/${reviewId}`),
  getFeedbackStats: (repo?: string) =>
    api.get('/memory/feedback-stats', { params: { repo } }),
  findSimilar: (query: string, repo?: string, top_k = 5) =>
    api.get('/memory/similar', { params: { query, repo, top_k } }),
  getOnboardingGuide: (repo: string) => api.get(`/memory/onboarding/${repo}`),
}

export default api
