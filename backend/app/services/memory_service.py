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
_conn = None


def _get_conn():
    """Lazy singleton Postgres connection."""
    global _conn
    if _conn is not None:
        try:
            _conn.cursor().execute("SELECT 1")
            return _conn
        except Exception:
            _conn = None

    db_url = (
        os.getenv("PGVECTOR_CONN_STRING")
        or os.getenv("DATABASE_URL")
        or "postgresql://postgres:postgres@localhost:5432/ai_code_review"
    )

    try:
        import psycopg2
        _conn = psycopg2.connect(db_url)
        _conn.autocommit = True
        # Ensure pgvector extension and tables exist
        _run_migrations(_conn)
        return _conn
    except ImportError:
        print("[memory_service] psycopg2 not installed — running in mock mode")
        return None
    except Exception as e:
        print(f"[memory_service] Postgres connection failed: {e} — running in mock mode")
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
            print("[memory_service] Migration 001_memory_tables applied successfully")
        except Exception as e:
            print(f"[memory_service] Migration warning (may already exist): {e}")


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
    else:
        # Mock: return all stored embeddings with fake similarity
        results = []
        for row in _MOCK_REVIEW_EMBEDDINGS:
            if repo and row["repo"] != repo:
                continue
            results.append({**row, "similarity": 0.85})
        return results[:top_k]


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
        cur = conn.cursor()
        cur.execute(
            "UPDATE convention_rules SET enabled = FALSE WHERE id = %s", (rule_id,)
        )
        affected = cur.rowcount
        cur.close()
        return affected > 0
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
    else:
        return [f for f in _MOCK_FEEDBACK if f["review_id"] == review_id]


def get_feedback_stats(repo: Optional[str] = None) -> Dict[str, Any]:
    """Aggregate feedback stats: total, positive, negative, suppression rate."""
    conn = _get_conn()
    if conn:
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
    else:
        total = len(_MOCK_FEEDBACK)
        positive = sum(1 for f in _MOCK_FEEDBACK if f["thumbs_up"])
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
    """Build an onboarding guide from past review data and convention rules.

    Returns a structured dict that the frontend renders as markdown.
    """
    past_reviews = retrieve_similar_reviews(
        embedding=[0.0] * EMBEDDING_DIM,  # dummy — we just want all reviews for this repo
        repo=repo,
        top_k=50,
    )
    rules = list_convention_rules(repo=repo)
    feedback = get_feedback_stats(repo=repo)

    # Build sections
    recurring_patterns: List[str] = []
    seen_titles = set()
    for rev in past_reviews:
        for title in (rev.get("issue_titles") or "").split(" | "):
            title = title.strip()
            if title and title not in seen_titles:
                seen_titles.add(title)
                recurring_patterns.append(title)

    guide = {
        "repo": repo,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "sections": [
            {
                "title": "📋 Team Convention Rules",
                "content": [r["rule_text"] for r in rules] if rules else ["No convention rules defined yet. Add rules in the Convention Rules page."],
            },
            {
                "title": "🔁 Recurring Patterns & Landmines",
                "content": recurring_patterns[:20] if recurring_patterns else ["No recurring issues detected yet. Run more scans to build history."],
            },
            {
                "title": "📊 Feedback Summary",
                "content": [
                    f"Total feedback entries: {feedback['total']}",
                    f"Accepted suggestions: {feedback['positive']}",
                    f"Rejected suggestions: {feedback['negative']}",
                    f"False-positive suppression rate: {feedback['suppressionRate']:.0%}",
                ],
            },
            {
                "title": "🚀 Getting Started",
                "content": [
                    "1. Review detected issues in the Reviews tab",
                    "2. Use 👍/👎 on each finding to teach Raptor your team's preferences",
                    "3. Add convention rules in plain English to enforce team standards",
                    "4. Raptor will learn from your feedback and improve over time",
                ],
            },
        ],
    }
    return guide
