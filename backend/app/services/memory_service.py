"""
Memory Service — pgvector-backed team memory for Raptor.

Handles:
  • Storing review embeddings after each scan
  • Retrieving similar past reviews (RAG context)
  • Convention rules CRUD
  • Feedback storage & retrieval
  • Onboarding guide generation
"""

import os
import json
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any, Tuple
from dotenv import load_dotenv
from .embedding_service import EMBEDDING_DIM

load_dotenv()

# ---------------------------------------------------------------------------
# Postgres connection helpers  (sync via psycopg2 — keeps things simple)
# ---------------------------------------------------------------------------
from ..services.db import get_conn, release_conn
import logging

logger = logging.getLogger(__name__)


def _get_conn():
    """Get a Postgres connection from the pool, or return None for mock mode."""
    db_url = (
        os.getenv("PGVECTOR_CONN_STRING")
        or os.getenv("DATABASE_URL")
        or None
    )

    if not db_url:
        return None

    try:
        conn = get_conn()
        if conn:
            try:
                # Ensure migrations run once per connection acquisition path
                _run_migrations(conn)
            except Exception:
                logger.exception("Failed to run memory migrations")
            return conn
    except Exception:
        logger.exception("Failed to acquire Postgres connection for memory_service")
    return None


def _run_migrations(conn):
    """Run the memory-tables migration idempotently."""
    migration_path = os.path.join(
        os.path.dirname(__file__), "..", "..", "migrations", "001_memory_tables.sql"
    )
    if os.path.exists(migration_path):
        with open(migration_path, "r") as f:
            sql = f.read()
        try:
            cur = conn.cursor()
            cur.execute(sql)
            cur.close()
            logger.info("[memory_service] Migration 001_memory_tables applied successfully")
        except Exception as e:
            logger.warning("[memory_service] Migration warning (may already exist): %s", e)


# ---------------------------------------------------------------------------
# In-memory fallback store for dev without Postgres
# ---------------------------------------------------------------------------
_MOCK_REVIEW_EMBEDDINGS: List[Dict[str, Any]] = []
_MOCK_CONVENTION_RULES: List[Dict[str, Any]] = []
_MOCK_FEEDBACK: List[Dict[str, Any]] = []
_MOCK_ID_COUNTER = 0


def _next_mock_id() -> int:
    global _MOCK_ID_COUNTER
    _MOCK_ID_COUNTER += 1
    return _MOCK_ID_COUNTER


# ---------------------------------------------------------------------------
# Review Embeddings
# ---------------------------------------------------------------------------
def store_review_embedding(
    review_id: int,
    repo: str,
    pr_number: int,
    issue_titles: str,
    summary: str,
    embedding: List[float],
) -> int:
    """Persist a review embedding. Returns the row id."""
    conn = _get_conn()
    if conn:
        try:
            cur = conn.cursor()
            cur.execute(
                """INSERT INTO review_embeddings
                       (review_id, repo, pr_number, issue_titles, summary, embedding)
                   VALUES (%s, %s, %s, %s, %s, %s::vector)
                   RETURNING id""",
                (review_id, repo, pr_number, issue_titles, summary, str(embedding)),
            )
            row_id = cur.fetchone()[0]
            cur.close()
            return row_id
        finally:
            try:
                release_conn(conn)
            except Exception:
                pass
    else:
        row = {
            "id": _next_mock_id(),
            "review_id": review_id,
            "repo": repo,
            "pr_number": pr_number,
            "issue_titles": issue_titles,
            "summary": summary,
            "embedding": embedding,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        _MOCK_REVIEW_EMBEDDINGS.append(row)
        return row["id"]


def retrieve_similar_reviews(
    embedding: List[float],
    repo: Optional[str] = None,
    top_k: int = 5,
) -> List[Dict[str, Any]]:
    """Return the top-k most similar past reviews by cosine distance."""
    conn = _get_conn()
    if conn:
        try:
            cur = conn.cursor()
            if repo:
                cur.execute(
                    """SELECT id, review_id, repo, pr_number, issue_titles, summary,
                              1 - (embedding <=> %s::vector) AS similarity,
                              created_at
                       FROM review_embeddings
                       WHERE repo = %s
                       ORDER BY embedding <=> %s::vector
                       LIMIT %s""",
                    (str(embedding), repo, str(embedding), top_k),
                )
            else:
                cur.execute(
                    """SELECT id, review_id, repo, pr_number, issue_titles, summary,
                              1 - (embedding <=> %s::vector) AS similarity,
                              created_at
                       FROM review_embeddings
                       ORDER BY embedding <=> %s::vector
                       LIMIT %s""",
                    (str(embedding), str(embedding), top_k),
                )
            columns = [d[0] for d in cur.description]
            results = [dict(zip(columns, row)) for row in cur.fetchall()]
            cur.close()
            # Serialise datetimes
            for r in results:
                if hasattr(r.get("created_at"), "isoformat"):
                    r["created_at"] = r["created_at"].isoformat()
                r["similarity"] = float(r.get("similarity", 0))
            return results
        finally:
            try:
                release_conn(conn)
            except Exception:
                pass
    else:
        # Mock: return all stored embeddings with fake similarity
        results = []
        for row in _MOCK_REVIEW_EMBEDDINGS:
            if repo and row["repo"] != repo:
                continue
            results.append({**row, "similarity": 0.85})
        return results[:top_k]


def list_review_memories(repo: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
    """Return recent stored review memories for generated repo summaries."""
    conn = _get_conn()
    if conn:
        try:
            cur = conn.cursor()
            if repo:
                cur.execute(
                    """SELECT id, review_id, repo, pr_number, issue_titles, summary, created_at
                       FROM review_embeddings
                       WHERE repo = %s
                       ORDER BY created_at DESC
                       LIMIT %s""",
                    (repo, limit),
                )
            else:
                cur.execute(
                    """SELECT id, review_id, repo, pr_number, issue_titles, summary, created_at
                       FROM review_embeddings
                       ORDER BY created_at DESC
                       LIMIT %s""",
                    (limit,),
                )
            columns = [d[0] for d in cur.description]
            results = [dict(zip(columns, row)) for row in cur.fetchall()]
            cur.close()
            for r in results:
                if hasattr(r.get("created_at"), "isoformat"):
                    r["created_at"] = r["created_at"].isoformat()
            return results
        finally:
            try:
                release_conn(conn)
            except Exception:
                pass

    results = []
    for row in sorted(_MOCK_REVIEW_EMBEDDINGS, key=lambda r: r.get("created_at", ""), reverse=True):
        if repo and row["repo"] != repo:
            continue
        copy = {k: v for k, v in row.items() if k != "embedding"}
        results.append(copy)
    return results[:limit]


def _split_issue_titles(issue_titles: str) -> List[str]:
    """Split stored issue title strings while ignoring empty/no-issue markers."""
    titles = []
    for title in (issue_titles or "").split(" | "):
        normalized = title.strip()
        if normalized and normalized.lower() != "no issues":
            titles.append(normalized)
    return titles


def get_onboarding_stats(repo: str) -> Dict[str, Any]:
    """Generate onboarding statistics from stored review memories and feedback."""
    review_memories = list_review_memories(repo=repo, limit=500)
    feedback = get_feedback_stats(repo=repo)
    pattern_counts: Dict[str, int] = {}
    issue_total = 0
    pr_numbers = set()
    latest_scan: Optional[str] = None

    for review in review_memories:
        pr_numbers.add(review.get("pr_number"))
        created_at = review.get("created_at")
        if created_at and (latest_scan is None or created_at > latest_scan):
            latest_scan = created_at
        for title in _split_issue_titles(review.get("issue_titles") or ""):
            issue_total += 1
            pattern_counts[title] = pattern_counts.get(title, 0) + 1

    top_patterns = [
        {"title": title, "count": count}
        for title, count in sorted(pattern_counts.items(), key=lambda item: (-item[1], item[0]))[:10]
    ]
    return {
        "reviewCount": len(review_memories),
        "pullRequestCount": len([p for p in pr_numbers if p is not None]),
        "issueCount": issue_total,
        "conventionRuleCount": len(list_convention_rules(repo=repo)),
        "feedbackTotal": feedback["total"],
        "feedbackAccepted": feedback["positive"],
        "feedbackRejected": feedback["negative"],
        "suppressionRate": feedback["suppressionRate"],
        "latestScanAt": latest_scan,
        "topPatterns": top_patterns,
    }


# ---------------------------------------------------------------------------
# Convention Rules
# ---------------------------------------------------------------------------
def add_convention_rule(
    rule_text: str,
    embedding: List[float],
    repo: str = "*",
    org: str = "*",
) -> Dict[str, Any]:
    """Add a plain-English convention rule."""
    conn = _get_conn()
    if conn:
        try:
            cur = conn.cursor()
            cur.execute(
                """INSERT INTO convention_rules (repo, org, rule_text, embedding)
                   VALUES (%s, %s, %s, %s::vector)
                   RETURNING id, repo, org, rule_text, enabled, created_at""",
                (repo, org, rule_text, str(embedding)),
            )
            columns = [d[0] for d in cur.description]
            row = dict(zip(columns, cur.fetchone()))
            cur.close()
            if hasattr(row.get("created_at"), "isoformat"):
                row["created_at"] = row["created_at"].isoformat()
            return row
        finally:
            try:
                release_conn(conn)
            except Exception:
                pass
    else:
        row = {
            "id": _next_mock_id(),
            "repo": repo,
            "org": org,
            "rule_text": rule_text,
            "enabled": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        _MOCK_CONVENTION_RULES.append(row)
        return row


def list_convention_rules(repo: str = "*") -> List[Dict[str, Any]]:
    """Return all convention rules, optionally filtered by repo."""
    conn = _get_conn()
    if conn:
        try:
            cur = conn.cursor()
            if repo == "*":
                cur.execute(
                    """SELECT id, repo, org, rule_text, enabled, created_at
                       FROM convention_rules
                       WHERE enabled = TRUE
                       ORDER BY created_at DESC"""
                )
            else:
                cur.execute(
                    """SELECT id, repo, org, rule_text, enabled, created_at
                       FROM convention_rules
                       WHERE enabled = TRUE AND (repo = %s OR repo = '*')
                       ORDER BY created_at DESC""",
                    (repo,),
                )
            columns = [d[0] for d in cur.description]
            results = [dict(zip(columns, row)) for row in cur.fetchall()]
            cur.close()
            for r in results:
                if hasattr(r.get("created_at"), "isoformat"):
                    r["created_at"] = r["created_at"].isoformat()
            return results
        finally:
            try:
                release_conn(conn)
            except Exception:
                pass
    else:
        if repo == "*":
            return [r for r in _MOCK_CONVENTION_RULES if r.get("enabled", True)]
        return [
            r for r in _MOCK_CONVENTION_RULES
            if r.get("enabled", True) and r["repo"] in (repo, "*")
        ]


def delete_convention_rule(rule_id: int) -> bool:
    """Soft-delete (disable) a convention rule."""
    conn = _get_conn()
    if conn:
        try:
            cur = conn.cursor()
            cur.execute(
                "UPDATE convention_rules SET enabled = FALSE WHERE id = %s", (rule_id,)
            )
            affected = cur.rowcount
            cur.close()
            return affected > 0
        finally:
            try:
                release_conn(conn)
            except Exception:
                pass
    else:
        for r in _MOCK_CONVENTION_RULES:
            if r["id"] == rule_id:
                r["enabled"] = False
                return True
        return False


def find_relevant_rules(
    embedding: List[float],
    repo: str = "*",
    threshold: float = 0.65,
    top_k: int = 10,
) -> List[Dict[str, Any]]:
    """Find convention rules that are semantically close to the given embedding."""
    conn = _get_conn()
    if conn:
        try:
            cur = conn.cursor()
            cur.execute(
                """SELECT id, repo, org, rule_text,
                          1 - (embedding <=> %s::vector) AS similarity
                   FROM convention_rules
                   WHERE enabled = TRUE
                     AND (repo = %s OR repo = '*')
                     AND 1 - (embedding <=> %s::vector) >= %s
                   ORDER BY embedding <=> %s::vector
                   LIMIT %s""",
                (str(embedding), repo, str(embedding), threshold, str(embedding), top_k),
            )
            columns = [d[0] for d in cur.description]
            results = [dict(zip(columns, row)) for row in cur.fetchall()]
            cur.close()
            for r in results:
                r["similarity"] = float(r.get("similarity", 0))
            return results
        finally:
            try:
                release_conn(conn)
            except Exception:
                pass
    else:
        return [
            {**r, "similarity": 0.70}
            for r in _MOCK_CONVENTION_RULES
            if r.get("enabled", True) and r["repo"] in (repo, "*")
        ][:top_k]


# ---------------------------------------------------------------------------
# Feedback
# ---------------------------------------------------------------------------
def store_feedback(
    review_id: int,
    issue_index: int,
    thumbs_up: bool,
    comment: Optional[str] = None,
) -> Dict[str, Any]:
    """Record thumbs-up/down feedback for a specific issue in a review."""
    conn = _get_conn()
    if conn:
        try:
            cur = conn.cursor()
            cur.execute(
                """INSERT INTO review_feedback (review_id, issue_index, thumbs_up, comment)
                   VALUES (%s, %s, %s, %s)
                   RETURNING id, review_id, issue_index, thumbs_up, comment, created_at""",
                (review_id, issue_index, thumbs_up, comment),
            )
            columns = [d[0] for d in cur.description]
            row = dict(zip(columns, cur.fetchone()))
            cur.close()
            if hasattr(row.get("created_at"), "isoformat"):
                row["created_at"] = row["created_at"].isoformat()
            return row
        finally:
            try:
                release_conn(conn)
            except Exception:
                pass
    else:
        row = {
            "id": _next_mock_id(),
            "review_id": review_id,
            "issue_index": issue_index,
            "thumbs_up": thumbs_up,
            "comment": comment,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        _MOCK_FEEDBACK.append(row)
        return row


def get_feedback_for_review(review_id: int) -> List[Dict[str, Any]]:
    """Return all feedback entries for a given review."""
    conn = _get_conn()
    if conn:
        try:
            cur = conn.cursor()
            cur.execute(
                """SELECT id, review_id, issue_index, thumbs_up, comment, created_at
                   FROM review_feedback
                   WHERE review_id = %s
                   ORDER BY issue_index""",
                (review_id,),
            )
            columns = [d[0] for d in cur.description]
            results = [dict(zip(columns, row)) for row in cur.fetchall()]
            cur.close()
            for r in results:
                if hasattr(r.get("created_at"), "isoformat"):
                    r["created_at"] = r["created_at"].isoformat()
            return results
        finally:
            try:
                release_conn(conn)
            except Exception:
                pass
    else:
        return [f for f in _MOCK_FEEDBACK if f["review_id"] == review_id]


def get_feedback_stats(repo: Optional[str] = None) -> Dict[str, Any]:
    """Aggregate feedback stats: total, positive, negative, suppression rate."""
    conn = _get_conn()
    if conn:
        try:
            cur = conn.cursor()
            if repo:
                cur.execute(
                    """SELECT
                         COUNT(*) AS total,
                         SUM(CASE WHEN f.thumbs_up THEN 1 ELSE 0 END) AS positive,
                         SUM(CASE WHEN NOT f.thumbs_up THEN 1 ELSE 0 END) AS negative
                       FROM review_feedback f
                       JOIN review_embeddings re ON re.review_id = f.review_id
                       WHERE re.repo = %s""",
                    (repo,),
                )
            else:
                cur.execute(
                    """SELECT
                         COUNT(*) AS total,
                         SUM(CASE WHEN thumbs_up THEN 1 ELSE 0 END) AS positive,
                         SUM(CASE WHEN NOT thumbs_up THEN 1 ELSE 0 END) AS negative
                       FROM review_feedback"""
                )
            row = cur.fetchone()
            cur.close()
            total = row[0] or 0
            positive = row[1] or 0
            negative = row[2] or 0
            return {
                "total": total,
                "positive": positive,
                "negative": negative,
                "suppressionRate": round(negative / total, 2) if total else 0.0,
            }
        finally:
            try:
                release_conn(conn)
            except Exception:
                pass
    else:
        feedback_rows = _MOCK_FEEDBACK
        if repo:
            review_ids = {r["review_id"] for r in _MOCK_REVIEW_EMBEDDINGS if r["repo"] == repo}
            feedback_rows = [f for f in _MOCK_FEEDBACK if f["review_id"] in review_ids]
        total = len(feedback_rows)
        positive = sum(1 for f in feedback_rows if f["thumbs_up"])
        negative = total - positive
        return {
            "total": total,
            "positive": positive,
            "negative": negative,
            "suppressionRate": round(negative / total, 2) if total else 0.0,
        }


# ---------------------------------------------------------------------------
# Onboarding Guide Generator
# ---------------------------------------------------------------------------
def generate_onboarding_guide(repo: str) -> Dict[str, Any]:
    """Build an onboarding guide from stored scan data, rules, and feedback."""
    review_memories = list_review_memories(repo=repo, limit=50)
    rules = list_convention_rules(repo=repo)
    stats = get_onboarding_stats(repo=repo)

    recurring_patterns = [
        f"{item['title']} ({item['count']} occurrence{'s' if item['count'] != 1 else ''})"
        for item in stats["topPatterns"]
    ]
    recent_reviews = [
        f"PR #{review['pr_number']}: {review.get('summary') or 'No summary recorded'}"
        for review in review_memories[:5]
    ]

    guide = {
        "repo": repo,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "stats": stats,
        "sections": [
            {
                "title": "Repository Scan Summary",
                "content": [
                    f"Reviews analyzed: {stats['reviewCount']}",
                    f"Pull requests covered: {stats['pullRequestCount']}",
                    f"Issues detected: {stats['issueCount']}",
                    f"Latest scan: {stats['latestScanAt'] or 'No scans recorded'}",
                ],
            },
            {
                "title": "Team Convention Rules",
                "content": [r["rule_text"] for r in rules] if rules else ["No convention rules defined yet. Add rules in the Convention Rules page."],
            },
            {
                "title": "Recurring Patterns and Landmines",
                "content": recurring_patterns if recurring_patterns else ["No recurring issues detected yet. Run more scans to build history."],
            },
            {
                "title": "Feedback Summary",
                "content": [
                    f"Total feedback entries: {stats['feedbackTotal']}",
                    f"Accepted suggestions: {stats['feedbackAccepted']}",
                    f"Rejected suggestions: {stats['feedbackRejected']}",
                    f"False-positive suppression rate: {stats['suppressionRate']:.0%}",
                ],
            },
            {
                "title": "Recent Review Context",
                "content": recent_reviews if recent_reviews else ["No stored review summaries yet. Run a scan to generate repository-specific context."],
            },
            {
                "title": "Getting Started",
                "content": [
                    "1. Review detected issues in the Reviews tab",
                    "2. Mark each finding as useful or not useful so Raptor learns team preferences",
                    "3. Add convention rules in plain English to enforce team standards",
                    "4. Re-run scans after new pull requests to refresh this guide",
                ],
            },
        ],
    }
    return guide
