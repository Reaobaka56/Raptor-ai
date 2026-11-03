"""
Telemetry router — real stats from the reviews DB table.
Falls back to empty stats if DB is unavailable.
"""
import logging
from fastapi import APIRouter, Depends
from typing import Optional
from .models import Stats
from .services.db import get_conn, release_conn
from .auth_dependencies import get_required_github_session, get_current_user
from .reviews_router import review_scope_sql

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["Telemetry"])

_EMPTY_STATS = dict(
    totalReviews=0, totalIssues=0, avgReviewTime=0,
    issuesBySeverity={"critical": 0, "high": 0, "medium": 0, "low": 0},
    issuesByCategory={"security": 0, "performance": 0, "quality": 0, "design": 0},
    reviewsOverTime=[],
)


@router.get("/stats", response_model=Stats)
async def get_stats(repo: Optional[str] = None, session: dict = Depends(get_required_github_session)):
    user = await get_current_user(session)
    conn = await get_conn()
    if not conn:
        # DB unavailable — return empty stats rather than fake data
        return Stats(**_EMPTY_STATS)

    try:
        # Every query is tenant-scoped; `repo` narrows further.
        scope, params = review_scope_sql(user)
        where = f"WHERE {scope}"
        if repo:
            params = params + [repo]
            where += f" AND github_repo = ${len(params)}"

        stats = await conn.fetchrow(
            f"SELECT COUNT(*) AS n, AVG(review_time_ms) AS avg_ms FROM reviews {where}", *params
        )
        total_reviews = int(stats["n"])
        avg_review_time = int(stats["avg_ms"]) if stats["avg_ms"] else 0

        row = await conn.fetchrow(
            f"""
            SELECT
                COUNT(*) FILTER (WHERE issue->>'severity' = 'critical'),
                COUNT(*) FILTER (WHERE issue->>'severity' = 'high'),
                COUNT(*) FILTER (WHERE issue->>'severity' = 'medium'),
                COUNT(*) FILTER (WHERE issue->>'severity' = 'low'),
                COUNT(*) FILTER (WHERE issue->>'category' = 'security'),
                COUNT(*) FILTER (WHERE issue->>'category' = 'performance'),
                COUNT(*) FILTER (WHERE issue->>'category' = 'quality'),
                COUNT(*) FILTER (WHERE issue->>'category' = 'design'),
                COUNT(*)
            FROM (SELECT issues FROM reviews {where}) r,
                 jsonb_array_elements(r.issues) AS issue
            """,
            *params,
        )

        row = list(row.values()) if row else [0] * 9
        critical, high, medium, low = int(row[0]), int(row[1]), int(row[2]), int(row[3])
        security, performance, quality, design = int(row[4]), int(row[5]), int(row[6]), int(row[7])
        total_issues = int(row[8])

        # Reviews over time (last 30 days)
        time_rows = await conn.fetch(
            f"""
            SELECT DATE(created_at) AS day, COUNT(*) AS review_count,
                   COALESCE(SUM(jsonb_array_length(issues)), 0) AS issue_count
            FROM reviews {where} AND created_at >= NOW() - INTERVAL '30 days'
            GROUP BY day ORDER BY day
            """,
            *params,
        )

        over_time = [
            {"date": str(r["day"]), "count": int(r["review_count"]), "issues": int(r["issue_count"])}
            for r in time_rows
        ]

        return Stats(
            totalReviews=total_reviews,
            totalIssues=total_issues,
            avgReviewTime=avg_review_time,
            issuesBySeverity={"critical": critical, "high": high, "medium": medium, "low": low},
            issuesByCategory={"security": security, "performance": performance, "quality": quality, "design": design},
            reviewsOverTime=over_time,
        )

    except Exception:
        logger.exception("Stats query failed")
        return Stats(**_EMPTY_STATS)
    finally:
        await release_conn(conn)
