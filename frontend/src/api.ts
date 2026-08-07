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

// On 401, clear stale session and redirect to home
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const hadToken = !!localStorage.getItem('token')
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.dispatchEvent(new Event('auth-change'))
      if (hadToken) {
        // Only redirect if user was logged in — avoids redirect loops on public pages
        window.location.href = '/?session_expired=1'
      }
    }
    return Promise.reject(error)
  }
)

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
  created_at: string; role?: string; join_token?: string; join_token_configured?: boolean
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
  leaveTeam: (teamId: string) =>
    api.delete(`/teams/${teamId}/leave`),
  deleteTeam: (teamId: string) =>
    api.delete(`/teams/${teamId}`),
  invite: (teamId: string, data: { invitee_email?: string; invitee_github?: string; role?: string }) =>
    api.post<Invitation>(`/teams/${teamId}/invitations`, data),
  getInvitation: (token: string) => api.get<Invitation>(`/teams/invitations/${token}`),
  acceptInvitation: (token: string) => api.post(`/teams/invitations/${token}/accept`),
  joinByToken: (token: string) => api.post<Team>('/teams/join', { token }),
  regenerateToken: (teamId: string) => api.post<{ join_token: string }>(`/teams/${teamId}/join-token/regenerate`),
}

export interface ProviderKey { id: string; provider: string; label: string; model?: string; key_preview: string; is_active: boolean; created_at: string }
export const providerKeysApi = {
  providers: () => api.get<Record<string, { name: string; models: string[] }>>('/keys/providers'),
  list: () => api.get<ProviderKey[]>('/keys'),
  save: (provider: string, api_key: string, label = 'My Key', model?: string) =>
    api.post<ProviderKey>('/keys', { provider, api_key, label, model }),
  test: (id: string) => api.post(`/keys/${id}/test`),
  delete: (id: string) => api.delete(`/keys/${id}`),
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

// ── Repo file browser types ───────────────────────────────────────────────────

export interface RepoTreeItem {
  name: string; path: string; type: 'file' | 'dir'
  size: number; sha: string; url: string
}

export interface RepoTree {
  type: 'directory' | 'file'; path: string
  items?: RepoTreeItem[]; item?: any
}

export interface RepoFile {
  name: string; path: string; content: string
  size: number; sha: string; html_url: string
}

export interface Commit {
  sha: string; short_sha: string; message: string; full_message: string
  author: { name: string; email: string; login?: string; avatar_url?: string }
  date: string; html_url: string
}

export interface CommitDetail extends Commit {
  stats: { additions: number; deletions: number; total: number }
  files: { filename: string; status: string; additions: number; deletions: number; patch: string }[]
}

export const repoExplorerApi = {
  getTree: (owner: string, repo: string, path = '', ref = '') =>
    api.get<RepoTree>(`/repos/${owner}/${repo}/tree`, { params: { path, ref } }),
  getFile: (owner: string, repo: string, path: string, ref = '') =>
    api.get<RepoFile>(`/repos/${owner}/${repo}/file`, { params: { path, ref } }),
  getCommits: (owner: string, repo: string, branch = '', path = '', page = 1, perPage = 30) =>
    api.get<Commit[]>(`/repos/${owner}/${repo}/commits`, { params: { branch, path, page, per_page: perPage } }),
  getCommitDetail: (owner: string, repo: string, sha: string) =>
    api.get<CommitDetail>(`/repos/${owner}/${repo}/commits/${sha}`),
  getBranches: (owner: string, repo: string) =>
    api.get<{ name: string; sha: string }[]>(`/repos/${owner}/${repo}/branches`),
}

// ── Chat types ────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string; sender_id: string; receiver_id: string
  content: string; read: boolean; created_at: string
  sender_username?: string; sender_avatar?: string
}

export interface ChatConversation {
  partner_id: string; partner_username: string; partner_avatar?: string
  last_message: string; last_at: string; unread_count: number
}

export const chatApi = {
  getConversations: () => api.get<ChatConversation[]>('/chat/conversations'),
  getMessages: (username: string, before?: string) =>
    api.get<{ messages: ChatMessage[]; other_user: any }>(`/chat/messages/${username}`, { params: before ? { before } : {} }),
  sendMessage: (receiver_username: string, content: string) =>
    api.post<ChatMessage>('/chat/messages', { receiver_username, content }),
  getUnreadCount: () => api.get<{ count: number }>('/chat/unread-count'),
  searchUsers: (q: string) => api.get<any[]>('/chat/users/search', { params: { q } }),
}



export interface OnboardingStats {
  reviewCount: number
  latestScanAt: string | null
  pullRequestCount: number
  issueCount: number
  feedbackTotal: number
  feedbackAccepted: number
  feedbackRejected: number
  suppressionRate: number
  // legacy fields kept for compatibility
  totalRules?: number
  totalFeedback?: number
  thumbsUp?: number
  thumbsDown?: number
  accuracy?: number
}

export const prApi = {
  createPullRequest: (reviewId: number) =>
    api.post<{ pr_url: string; pr_number: number }>(`/reviews/${reviewId}/create-fix-pr`),
}

// ── Multi-Agent API ────────────────────────────────────────────────────────────

export interface Agent {
  id: string; owner_id: string; name: string; role: string
  description?: string; system_prompt?: string; model: string
  provider: string; tools: string[]; permissions: Record<string, any>
  status: string; sandbox_id?: string; current_task_id?: string
  config: Record<string, any>; knowledge_sources: string[]
  created_at: string; updated_at: string
}

export interface AgentTask {
  id: string; owner_id: string; title: string; description?: string
  priority: number; status: string; assigned_agent_id?: string
  parent_task_id?: string; dependencies: string[]
  input_context?: string; output?: string; logs: any[]; errors: any[]
  review_status: string; metadata: Record<string, any>
  started_at?: string; completed_at?: string
  created_at: string; updated_at: string
}

export interface AgentMessage {
  id: string; owner_id: string; from_agent_id?: string; to_agent_id?: string
  message_type: string; content: string; task_id?: string
  metadata: Record<string, any>; read: boolean; created_at: string
  from_agent_name?: string; to_agent_name?: string
}

export interface AgentActivity {
  id: string; owner_id: string; agent_id?: string
  activity_type: string; description: string
  metadata: Record<string, any>; created_at: string
}

export const agentApi = {
  list: () => api.get<Agent[]>('/agents'),
  get: (id: string) => api.get<Agent>(`/agents/${id}`),
  create: (data: Partial<Agent>) => api.post<Agent>('/agents', data),
  update: (id: string, data: Partial<Agent>) => api.patch<Agent>(`/agents/${id}`, data),
  delete: (id: string) => api.delete(`/agents/${id}`),
  getTemplates: () => api.get<Record<string, any>>('/agents/templates'),
  updateStatus: (id: string, status: string) => api.post<Agent>(`/agents/${id}/status`, { status }),
  getActivity: (id: string, limit = 100) => api.get<AgentActivity[]>(`/agents/${id}/activity`, { params: { limit } }),
}

export const taskApi = {
  list: (params?: { status?: string; agent_id?: string }) => api.get<AgentTask[]>('/tasks', { params }),
  get: (id: string) => api.get<AgentTask>(`/tasks/${id}`),
  create: (data: Partial<AgentTask>) => api.post<AgentTask>('/tasks', data),
  update: (id: string, data: Partial<AgentTask>) => api.patch<AgentTask>(`/tasks/${id}`, data),
  delete: (id: string) => api.delete(`/tasks/${id}`),
}

export const sandboxApi = {
  // We redefine these here for easier access, even though Sandbox.tsx currently uses raw api.post
  pauseSession: (sessionId: string) => api.post(`/sandbox/sessions/${sessionId}/pause`),
  resumeSession: (sessionId: string) => api.post(`/sandbox/sessions/${sessionId}/resume`),
}

export default api

