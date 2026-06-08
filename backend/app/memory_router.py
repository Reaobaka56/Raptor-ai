"""
Memory Router — FastAPI endpoints for the team memory layer.

Mounts under /api/memory in the main app.
"""

from typing import Optional, List
from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel, Field

from .services.embedding_service import generate_embedding
from .services import memory_service
from .auth_dependencies import get_required_github_session

router = APIRouter(prefix="/memory", tags=["Team Memory"])


def require_authenticated_session():
    return get_required_github_session()


# ---------------------------------------------------------------------------
# Request / Response Models
# ---------------------------------------------------------------------------
class AddRuleRequest(BaseModel):
    rule_text: str = Field(..., min_length=3, description="Convention rule in plain English")
    repo: str = Field(default="*", description="Repository scope (owner/repo or * for global)")
    org: str = Field(default="*", description="Organisation scope")


class RuleResponse(BaseModel):
    id: int
    repo: str
    org: str
    rule_text: str
    enabled: bool
    created_at: str


class FeedbackRequest(BaseModel):
    review_id: int
    issue_index: int = Field(default=0, ge=0)
    thumbs_up: bool
    comment: Optional[str] = None


class FeedbackResponse(BaseModel):
    id: int
    review_id: int
    issue_index: int
    thumbs_up: bool
    comment: Optional[str]
    created_at: str


class SimilarReview(BaseModel):
    id: int
    review_id: int
    repo: str
    pr_number: int
    issue_titles: str
    summary: str
    similarity: float
    created_at: str


class FeedbackStats(BaseModel):
    total: int
    positive: int
    negative: int
    suppressionRate: float


class OnboardingPattern(BaseModel):
    title: str
    count: int


class OnboardingStats(BaseModel):
    reviewCount: int
    pullRequestCount: int
    issueCount: int
    conventionRuleCount: int
    feedbackTotal: int
    feedbackAccepted: int
    feedbackRejected: int
    suppressionRate: float
    latestScanAt: Optional[str] = None
    topPatterns: List[OnboardingPattern]


class OnboardingSection(BaseModel):
    title: str
    content: List[str]


class OnboardingGuide(BaseModel):
    repo: str
    generatedAt: str
    stats: OnboardingStats
    sections: List[OnboardingSection]


# ---------------------------------------------------------------------------
# Convention Rules Endpoints
# ---------------------------------------------------------------------------
@router.post("/rules", response_model=RuleResponse)
def add_rule(req: AddRuleRequest, session: Optional[dict] = Depends(require_authenticated_session)):
    """Add a plain-English convention rule. It gets embedded for semantic matching."""
    embedding = generate_embedding(req.rule_text)
    result = memory_service.add_convention_rule(
        rule_text=req.rule_text,
        embedding=embedding,
        repo=req.repo,
        org=req.org,
    )
    return result


@router.get("/rules", response_model=List[RuleResponse])
def get_rules(repo: str = Query(default="*", description="Filter by repo")):
    """List all active convention rules."""
    return memory_service.list_convention_rules(repo=repo)


@router.delete("/rules/{rule_id}")
def remove_rule(rule_id: int, session: Optional[dict] = Depends(require_authenticated_session)):
    """Disable (soft-delete) a convention rule."""
    success = memory_service.delete_convention_rule(rule_id)
    if not success:
        raise HTTPException(status_code=404, detail="Rule not found")
    return {"status": "deleted", "id": rule_id}


# ---------------------------------------------------------------------------
# Feedback Endpoints
# ---------------------------------------------------------------------------
@router.post("/feedback", response_model=FeedbackResponse)
def submit_feedback(req: FeedbackRequest, session: Optional[dict] = Depends(require_authenticated_session)):
    """Submit thumbs-up/down feedback on a specific review issue."""
    result = memory_service.store_feedback(
        review_id=req.review_id,
        issue_index=req.issue_index,
        thumbs_up=req.thumbs_up,
        comment=req.comment,
    )
    return result


@router.get("/feedback/{review_id}", response_model=List[FeedbackResponse])
def get_review_feedback(review_id: int):
    """Get all feedback for a specific review."""
    return memory_service.get_feedback_for_review(review_id)


@router.get("/feedback-stats", response_model=FeedbackStats)
def get_feedback_statistics(repo: Optional[str] = None):
    """Get aggregated feedback statistics."""
    return memory_service.get_feedback_stats(repo=repo)


# ---------------------------------------------------------------------------
# Similar Reviews (RAG Context)
# ---------------------------------------------------------------------------
@router.get("/similar", response_model=List[SimilarReview])
def find_similar_reviews(
    query: str = Query(..., min_length=3, description="Text to search for similar past reviews"),
    repo: Optional[str] = None,
    top_k: int = Query(default=5, ge=1, le=20),
):
    """Find past reviews similar to the given query text."""
    embedding = generate_embedding(query)
    results = memory_service.retrieve_similar_reviews(
        embedding=embedding, repo=repo, top_k=top_k
    )
    return results


# ---------------------------------------------------------------------------
# Onboarding Guide
# ---------------------------------------------------------------------------
@router.get("/onboarding/{repo:path}", response_model=OnboardingGuide)
def get_onboarding_guide(repo: str):
    """Generate an onboarding guide for the given repository."""
    guide = memory_service.generate_onboarding_guide(repo=repo)
    return guide
