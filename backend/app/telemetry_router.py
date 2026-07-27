"""
Telemetry router — real stats from the reviews DB table.
Falls back to empty stats if DB is unavailable.
"""
from fastapi import APIRouter
from typing import Optional
from .models import Stats
from .services.db import get_conn, release_conn

router = APIRouter(prefix="/api", tags=["Telemetry"])


@router.get("/stats", response_model=Stats)
def get_stats(repo: Optional[str] = None):
    conn = get_conn()
    if not conn:
        # DB unavailable — return empty stats rather than fake data
        return Stats(
            totalReviews=0, totalIssues=0, avgReviewTime=0,
            issuesBySeverity={"critical":0,"high":0,"medium":0,"low":0},
            issuesByCategory={"security":0,"performance":0,"quality":0,"design":0},
            reviewsOverTime=[],
        )

    try:
        with conn.cursor() as cur:
            # Total reviews
            if repo:
                cur.execute("SELECT COUNT(*) FROM reviews WHERE github_repo = %s", (repo,))
            else:
                cur.execute("SELECT COUNT(*) FROM reviews")
            total_reviews = cur.fetchone()[0]

            # Avg review time (ms)
            if repo:
                cur.execute("SELECT AVG(review_time_ms) FROM reviews WHERE github_repo = %s AND review_time_ms IS NOT NULL", (repo,))
            else:
                cur.execute("SELECT AVG(review_time_ms) FROM reviews WHERE review_time_ms IS NOT NULL")
            avg_time_row = cur.fetchone()[0]
            avg_review_time = int(avg_time_row) if avg_time_row else 0

            # Issues from JSONB issues column
            if repo:
                cur.execute("""
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
                        WHERE r.github_repo = %s
                    ) t
                """, (repo,))
            else:
                cur.execute("""
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
                    ) t
                """)

            row = cur.fetchone() or [0]*9
            critical, high, medium, low = int(row[0]), int(row[1]), int(row[2]), int(row[3])
            security, performance, quality, design = int(row[4]), int(row[5]), int(row[6]), int(row[7])
            total_issues = int(row[8])

            # Reviews over time (last 30 days)
            if repo:
                cur.execute("""
                    SELECT
                        DATE(created_at) AS day,
                        COUNT(*) AS review_count,
                        COALESCE(SUM(jsonb_array_length(issues)), 0) AS issue_count
                    FROM reviews
                    WHERE github_repo = %s
                      AND created_at >= NOW() - INTERVAL '30 days'
                    GROUP BY day ORDER BY day
                """, (repo,))
            else:
                cur.execute("""
                    SELECT
                        DATE(created_at) AS day,
                        COUNT(*) AS review_count,
                        COALESCE(SUM(jsonb_array_length(issues)), 0) AS issue_count
                    FROM reviews
                    WHERE created_at >= NOW() - INTERVAL '30 days'
                    GROUP BY day ORDER BY day
                """)

            over_time = [
                {"date": str(r[0]), "count": int(r[1]), "issues": int(r[2])}
                for r in cur.fetchall()
            ]

            return Stats(
                totalReviews=total_reviews,
                totalIssues=total_issues,
                avgReviewTime=avg_review_time,
                issuesBySeverity={"critical": critical, "high": high, "medium": medium, "low": low},
                issuesByCategory={"security": security, "performance": performance, "quality": quality, "design": design},
                reviewsOverTime=over_time,
            )

    except Exception as e:
        import logging
        logging.getLogger(__name__).exception("Stats query failed")
        return Stats(
            totalReviews=0, totalIssues=0, avgReviewTime=0,
            issuesBySeverity={"critical":0,"high":0,"medium":0,"low":0},
            issuesByCategory={"security":0,"performance":0,"quality":0,"design":0},
            reviewsOverTime=[],
        )
    finally:
        release_conn(conn)
