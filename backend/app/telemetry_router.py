from fastapi import APIRouter
from typing import Optional
from .models import Stats
from .state import MOCK_REVIEWS

router = APIRouter(prefix="/api", tags=["Telemetry"])


@router.get("/stats", response_model=Stats)
def get_stats(repo: Optional[str] = None):
    reviews = [r for r in MOCK_REVIEWS if not repo or r.get("githubRepo", "").lower() == repo.lower()]
    severity_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    category_counts = {"security": 0, "performance": 0, "quality": 0, "design": 0}
    for review in reviews:
        for issue in review.get("issues", []):
            severity_counts[issue.get("severity")] += 1
            category_counts[issue.get("category")] += 1
    review_times = [r.get("reviewTimeMs") for r in reviews if r.get("reviewTimeMs") is not None]
    avg_review_time = int(sum(review_times) / len(review_times)) if review_times else 0
    return Stats(
        totalReviews=len(reviews),
        totalIssues=sum(len(r.get("issues", [])) for r in reviews),
        avgReviewTime=avg_review_time,
        issuesBySeverity=severity_counts,
        issuesByCategory=category_counts,
        reviewsOverTime=[],
    )
