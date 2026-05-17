export interface ReviewIssue {
  file: string;
  line: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: 'security' | 'performance' | 'quality' | 'design';
  title: string;
  description: string;
  suggestion: string;
  codeSnippet?: string;
}

export interface ReviewResult {
  issues: ReviewIssue[];
  summary: string;
  stats: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    total: number;
  };
}

export interface PRContext {
  owner: string;
  repo: string;
  pullNumber: number;
  title: string;
  description: string;
  author: string;
  baseBranch: string;
  headBranch: string;
}

export interface FileDiff {
  filename: string;
  status: 'added' | 'modified' | 'removed';
  additions: number;
  deletions: number;
  patch: string;
  content?: string;
}

export interface WebhookPayload {
  action: string;
  pull_request: {
    number: number;
    title: string;
    body: string | null;
    user: { login: string };
    base: { ref: string; repo: { full_name: string } };
    head: { ref: string; sha: string };
    html_url: string;
  };
  repository: {
    full_name: string;
    owner: { login: string };
  };
  installation?: {
    id: number;
  };
}
