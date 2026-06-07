from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Literal
from datetime import datetime

class ReviewIssue(BaseModel):
    file: str = Field(..., description="Target file path")
    line: int = Field(..., description="Line number of the issue")
    severity: Literal['critical', 'high', 'medium', 'low']
    category: Literal['security', 'performance', 'quality', 'design']
    title: str
    description: str
    suggestion: str

class Review(BaseModel):
    id: str
    githubRepo: str
    prNumber: int
    prTitle: Optional[str] = None
    prUrl: Optional[str] = None
    issues: List[ReviewIssue] = []
    summary: Optional[str] = None
    status: str = "completed"
    reviewTimeMs: Optional[int] = None
    createdAt: str

class Pagination(BaseModel):
    total: int
    limit: int
    offset: int

class ReviewsResponse(BaseModel):
    reviews: List[Review]
    pagination: Pagination

class SeverityStats(BaseModel):
    critical: int
    high: int
    medium: int
    low: int

class CategoryStats(BaseModel):
    security: int
    performance: int
    quality: int
    design: int

class TimeSeriesPoint(BaseModel):
    date: str
    count: int
    issues: int

class Stats(BaseModel):
    totalReviews: int
    totalIssues: int
    avgReviewTime: int
    issuesBySeverity: SeverityStats
    issuesByCategory: CategoryStats
    reviewsOverTime: List[TimeSeriesPoint]

# Webhook payload models
class PullRequestModel(BaseModel):
    number: int
    title: str
    html_url: str
    diff_url: str
    state: str

class RepositoryModel(BaseModel):
    full_name: str
    html_url: str

class InstallationModel(BaseModel):
    id: int

class WebhookPayload(BaseModel):
    action: Optional[str] = None
    pull_request: Optional[PullRequestModel] = None
    repository: Optional[RepositoryModel] = None
    installation: Optional[InstallationModel] = None


# GitHub Auth & Repository management models
class RepositoryInfo(BaseModel):
    id: str
    fullName: str
    private: bool
    defaultBranch: str
    lastScan: Optional[str] = None
    issuesCount: int = 0
    language: str

class UserProfile(BaseModel):
    username: str
    avatarUrl: str
    githubId: int

class GitHubLoginUrlResponse(BaseModel):
    url: str

class GitHubAuthRequest(BaseModel):
    code: str
    redirectUri: str

class AuthResponse(BaseModel):
    token: str
    user: UserProfile
    repositories: List[RepositoryInfo]

class AuthCallbackRequest(BaseModel):
    code: str
    state: str
    redirectUri: Optional[str] = None

class ScanRequest(BaseModel):
    repo: str

class CreatePRResponse(BaseModel):
    status: str
    prNumber: int
    prUrl: str
    message: str

class WebhookLogItem(BaseModel):
    id: str
    repo: str
    event: str
    status: int
    time: str

class ParserStatusItem(BaseModel):
    language: str
    version: str
    status: str
    cacheHits: str

class SystemTelemetry(BaseModel):
    cpuLoad: float
    astCacheRate: float
    queueBacklog: int
    memoryUsedGb: float
    memoryTotalGb: float
    uptimeSec: int
    parsers: List[ParserStatusItem]
    webhookLogs: List[WebhookLogItem]
