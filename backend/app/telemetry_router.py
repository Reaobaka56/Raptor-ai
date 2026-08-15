"""
Telemetry router — real stats from the reviews DB table.
Falls back to empty stats if DB is unavailable.
"""
import logging
from fastapi import APIRouter
from typing import Optional
from .models import Stats
from .services.db import get_conn, release_conn

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["Telemetry"])

_EMPTY_STATS = dict(
    totalReviews=0, totalIssues=0, avgReviewTime=0,
    issuesBySeverity={"critical": 0, "high": 0, "medium": 0, "low": 0},
    issuesByCategory={"security": 0, "performance": 0, "quality": 0, "design": 0},
    reviewsOverTime=[],
)


@router.get("/stats", response_model=Stats)
async def get_stats(repo: Optional[str] = None):
    conn = await get_conn()
    if not conn:
        # DB unavailable — return empty stats rather than fake data
        return Stats(**_EMPTY_STATS)

    try:
        # Total reviews
        if repo:
            total_reviews = await conn.fetchval(
                "SELECT COUNT(*) FROM reviews WHERE github_repo = $1", repo,
            )
        else:
            total_reviews = await conn.fetchval("SELECT COUNT(*) FROM reviews")

        # Avg review time (ms)
        if repo:
            avg_time_row = await conn.fetchval(
                "SELECT AVG(review_time_ms) FROM reviews WHERE github_repo = $1 AND review_time_ms IS NOT NULL",
                repo,
            )
        else:
            avg_time_row = await conn.fetchval(
                "SELECT AVG(review_time_ms) FROM reviews WHERE review_time_ms IS NOT NULL"
            )
        avg_review_time = int(avg_time_row) if avg_time_row else 0

        # Issues from JSONB issues column
        issues_query = """
            SELECT
                COALESCE(SUM((issues_json->>'critical')::int), 0),
                COALESCE(SUM((issues_json->>'high')::int), 0),
                COALESCE(SUM((issues_json->>'medium')::int), 0),
                COALESCE(SUM((issues_json->>'low')::int), 0),
                COALESCE(SUM((issues_json->>'security')::int), 0),
                COALESCE(SUM((issues_json->>'performance')::int), 0),
                COALESCE(SUM((issues_json->>'quality')::int), 0),
                COALESCE(SUM((issues_json->>'design')::int), 0),
                COALESCE(SUM((issues_json->>'total')::int), 0)
            FROM (
                SELECT
                    jsonb_build_object(
                        'critical', COUNT(*) FILTER (WHERE issue->>'severity' = 'critical'),
                        'high',     COUNT(*) FILTER (WHERE issue->>'severity' = 'high'),
                        'medium',   COUNT(*) FILTER (WHERE issue->>'severity' = 'medium'),
                        'low',      COUNT(*) FILTER (WHERE issue->>'severity' = 'low'),
                        'security',    COUNT(*) FILTER (WHERE issue->>'category' = 'security'),
                        'performance', COUNT(*) FILTER (WHERE issue->>'category' = 'performance'),
                        'quality',     COUNT(*) FILTER (WHERE issue->>'category' = 'quality'),
                        'design',      COUNT(*) FILTER (WHERE issue->>'category' = 'design'),
                        'total',    COUNT(*)
                    ) AS issues_json
                FROM reviews r,
                     jsonb_array_elements(r.issues) AS issue
                {where_clause}
            ) t
        """
        if repo:
            row = await conn.fetchrow(
                issues_query.format(where_clause="WHERE r.github_repo = $1"), repo,
            )
        else:
            row = await conn.fetchrow(issues_query.format(where_clause=""))

        row = list(row.values()) if row else [0] * 9
        critical, high, medium, low = int(row[0]), int(row[1]), int(row[2]), int(row[3])
        security, performance, quality, design = int(row[4]), int(row[5]), int(row[6]), int(row[7])
        total_issues = int(row[8])

        # Reviews over time (last 30 days)
        time_query = """
            SELECT
                DATE(created_at) AS day,
                COUNT(*) AS review_count,
                COALESCE(SUM(jsonb_array_length(issues)), 0) AS issue_count
            FROM reviews
            WHERE created_at >= NOW() - INTERVAL '30 days'
            {and_repo}
            GROUP BY day ORDER BY day
        """
        if repo:
            time_rows = await conn.fetch(
                time_query.format(and_repo="AND github_repo = $1"), repo,
            )
        else:
            time_rows = await conn.fetch(time_query.format(and_repo=""))

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
