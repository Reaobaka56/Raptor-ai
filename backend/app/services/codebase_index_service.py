"""
Codebase Index Service — pgvector-backed repo-wide code index.

Reviews previously only saw the diff. That's blind to how a changed
function is called elsewhere, whether a duplicated helper already exists
in the repo, or whether a change breaks an implicit contract with another
file. This service indexes a repo's source files (chunked + embedded) so
`scan_service` can retrieve semantically related code from outside the
diff and hand it to the model as extra context.

Mirrors memory_service's connection/mock-fallback pattern so it degrades
gracefully without a configured Postgres/pgvector instance.
"""

import base64
import hashlib
import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx

from .db import get_conn, release_conn
from .embedding_service import generate_embedding

logger = logging.getLogger(__name__)

# Only index text/source files likely to be useful review context. Skips
# lockfiles, binaries, generated assets, and anything huge.
INDEXABLE_EXTENSIONS = {
    ".py", ".js", ".jsx", ".ts", ".tsx", ".go", ".rs", ".java", ".kt",
    ".rb", ".php", ".c", ".cc", ".cpp", ".h", ".hpp", ".cs", ".swift",
    ".sql", ".graphql", ".proto",
}
SKIP_PATH_SEGMENTS = {
    "node_modules", "dist", "build", "vendor", ".git", "__pycache__",
    "dist-electron", "coverage", ".venv", "venv",
}
MAX_FILE_BYTES = 60_000       # skip abnormally large generated/minified files
MAX_FILES_PER_INDEX = 300     # cap GitHub API + embedding calls per repo
CHUNK_LINES = 120             # ~120 lines per chunk, small enough for embedding relevance
CHUNK_OVERLAP = 15


def _should_index(path: str, size: int) -> bool:
    if size <= 0 or size > MAX_FILE_BYTES:
        return False
    if any(f"/{seg}/" in f"/{path}/" for seg in SKIP_PATH_SEGMENTS):
        return False
    ext = "." + path.rsplit(".", 1)[-1] if "." in path else ""
    return ext in INDEXABLE_EXTENSIONS


def _chunk_text(text: str) -> List[str]:
    lines = text.splitlines()
    if not lines:
        return []
    chunks = []
    step = max(1, CHUNK_LINES - CHUNK_OVERLAP)
    for start in range(0, len(lines), step):
        chunk = "\n".join(lines[start:start + CHUNK_LINES])
        if chunk.strip():
            chunks.append(chunk)
        if start + CHUNK_LINES >= len(lines):
            break
    return chunks


async def is_repo_indexed(repo: str) -> bool:
    conn = await get_conn()
    if not conn:
        return False
    try:
        row = await conn.fetchrow(
            "SELECT repo FROM code_index_state WHERE repo = $1", repo
        )
        return row is not None
    except Exception:
        logger.exception("[codebase_index] is_repo_indexed check failed")
        return False
    finally:
        await release_conn(conn)


async def index_repository(
    repo: str,
    github_token: str,
    commit_sha: Optional[str] = None,
) -> Dict[str, Any]:
    """Fetch the repo's file tree at HEAD (or commit_sha), embed indexable
    files in chunks, and upsert them into code_chunks. Best-effort — never
    raises; callers treat indexing as an optional context boost, not a
    dependency of the review itself."""
    from ..github_utils import get_github_auth_headers

    headers = get_github_auth_headers(github_token)
    file_count = 0
    chunk_count = 0

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            ref = commit_sha or "HEAD"
            tree_res = await client.get(
                f"https://api.github.com/repos/{repo}/git/trees/{ref}",
                headers=headers,
                params={"recursive": "1"},
            )
            tree_res.raise_for_status()
            tree = tree_res.json().get("tree", [])

            candidates = [
                item for item in tree
                if item.get("type") == "blob"
                and _should_index(item.get("path", ""), item.get("size", 0))
            ][:MAX_FILES_PER_INDEX]

            conn = await get_conn()
            if not conn:
                logger.warning("[codebase_index] no DB pool; skipping index for %s", repo)
                return {"repo": repo, "files": 0, "chunks": 0, "indexed": False}

            try:
                for item in candidates:
                    path = item["path"]
                    try:
                        blob_res = await client.get(
                            f"https://api.github.com/repos/{repo}/git/blobs/{item['sha']}",
                            headers=headers,
                        )
                        blob_res.raise_for_status()
                        blob = blob_res.json()
                        if blob.get("encoding") != "base64":
                            continue
                        content = base64.b64decode(blob["content"]).decode("utf-8", errors="ignore")
                    except Exception:
                        continue

                    content_hash = hashlib.sha256(content.encode("utf-8")).hexdigest()
                    chunks = _chunk_text(content)
                    if not chunks:
                        continue

                    for idx, chunk in enumerate(chunks):
                        embedding = generate_embedding(f"# {path}\n{chunk}")
                        await conn.execute(
                            """INSERT INTO code_chunks
                                   (repo, file_path, chunk_index, content, content_hash, embedding, indexed_at)
                               VALUES ($1, $2, $3, $4, $5, $6::vector, now())
                               ON CONFLICT (repo, file_path, chunk_index)
                               DO UPDATE SET content = EXCLUDED.content,
                                             content_hash = EXCLUDED.content_hash,
                                             embedding = EXCLUDED.embedding,
                                             indexed_at = now()
                               WHERE code_chunks.content_hash != EXCLUDED.content_hash""",
                            repo, path, idx, chunk, content_hash, str(embedding),
                        )
                        chunk_count += 1
                    file_count += 1

                await conn.execute(
                    """INSERT INTO code_index_state (repo, last_indexed_sha, file_count, chunk_count, updated_at)
                       VALUES ($1, $2, $3, $4, now())
                       ON CONFLICT (repo) DO UPDATE
                       SET last_indexed_sha = EXCLUDED.last_indexed_sha,
                           file_count = EXCLUDED.file_count,
                           chunk_count = EXCLUDED.chunk_count,
                           updated_at = now()""",
                    repo, commit_sha, file_count, chunk_count,
                )
            finally:
                await release_conn(conn)

        logger.info("[codebase_index] indexed %s: %d files, %d chunks", repo, file_count, chunk_count)
        return {"repo": repo, "files": file_count, "chunks": chunk_count, "indexed": True}

    except Exception:
        logger.exception("[codebase_index] failed to index %s", repo)
        return {"repo": repo, "files": file_count, "chunks": chunk_count, "indexed": False}


async def retrieve_relevant_context(
    repo: str,
    query_text: str,
    changed_files: Optional[List[str]] = None,
    top_k: int = 6,
) -> List[Dict[str, Any]]:
    """Return the top-k code chunks in `repo` most semantically related to
    `query_text` (typically the PR diff or a summary of it), excluding
    chunks from files already in the diff — those are already visible to
    the model, so surfacing them again just wastes context."""
    conn = await get_conn()
    if not conn:
        return []
    try:
        embedding = generate_embedding(query_text[:8000])
        emb = str(embedding)
        exclude = changed_files or []
        rows = await conn.fetch(
            """SELECT file_path, content,
                      1 - (embedding <=> $1::vector) AS similarity
               FROM code_chunks
               WHERE repo = $2
                 AND NOT (file_path = ANY($3::text[]))
               ORDER BY embedding <=> $1::vector
               LIMIT $4""",
            emb, repo, exclude, top_k,
        )
        return [
            {"file_path": r["file_path"], "content": r["content"], "similarity": float(r["similarity"])}
            for r in rows
        ]
    except Exception:
        logger.exception("[codebase_index] retrieval failed for %s", repo)
        return []
    finally:
        await release_conn(conn)
