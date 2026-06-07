from fastapi import APIRouter, HTTPException
from typing import List

from .models import Review, CreatePRResponse
from .services.github_app import github_app_service
from .state import MOCK_REVIEWS

router = APIRouter(prefix="/api", tags=["Reviews"])


@router.get("/reviews", response_model=List[Review])
def get_all_reviews():
    return MOCK_REVIEWS


@router.get("/reviews/{review_id}", response_model=Review)
def get_review_by_id(review_id: str):
    for r in MOCK_REVIEWS:
        if r.get("id") == review_id:
            return r
    raise HTTPException(status_code=404, detail="Review not found")


@router.post("/reviews/{review_id}/pull-request", response_model=CreatePRResponse)
def create_fix_pull_request(review_id: str):
    for review in MOCK_REVIEWS:
        if review.get("id") == review_id:
            if review.get("fixPrUrl") and review.get("fixPrNumber"):
                return CreatePRResponse(
                    status="pr_created",
                    prNumber=review.get("fixPrNumber"),
                    prUrl=review.get("fixPrUrl"),
                    message="Fix pull request already created for this review.",
                )
            try:
                pr = github_app_service.create_fix_pull_request(review)
            except Exception as exc:
                raise HTTPException(status_code=502, detail=f"GitHub App pull request creation failed: {exc}") from exc

            review["status"] = "pr_created"
            review["fixPrNumber"] = pr["number"]
            review["fixPrUrl"] = pr["html_url"]
            return CreatePRResponse(
                status="pr_created",
                prNumber=review.get("fixPrNumber"),
                prUrl=review.get("fixPrUrl"),
                message="Created a remediation pull request with the installed GitHub App.",
            )

    raise HTTPException(status_code=404, detail="Review not found")
