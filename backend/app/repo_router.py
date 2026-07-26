"""
Repo router — real GitHub API integration for file browser and commit history.
Uses the authenticated user's OAuth token from their session.
"""
import asyncio
import requests
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query

from .auth_dependencies import get_required_github_session

router = APIRouter(prefix="/api/repos", tags=["Repositories"])


def _gh_headers(token: str) -> Dict[str, str]:
    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }


def _gh_get(token: str, url: str, params: dict = None) -> Any:
    """Synchronous GitHub API GET — wrapped in asyncio.to_thread at call sites."""
    resp = requests.get(url, headers=_gh_headers(token), params=params or {}, timeout=15)
    if resp.status_code == 404:
        return None
    if resp.status_code == 403:
        raise HTTPException(status_code=403, detail="GitHub rate limit exceeded or insufficient permissions")
    if not resp.ok:
        raise HTTPException(status_code=resp.status_code, detail=f"GitHub API error: {resp.text[:200]}")
    return resp.json()


# ── File tree ─────────────────────────────────────────────────────────────────

@router.get("/{owner}/{repo}/tree")
async def get_file_tree(
    owner: str, repo: str,
    path: str = Query(default="", description="Subdirectory path, empty = root"),
    ref: str = Query(default="", description="Branch or commit SHA, empty = default branch"),
    session: Dict[str, Any] = Depends(get_required_github_session),
):
    """Return directory contents for a repo path."""
    token = session.get("access_token", "")
    if not token:
        raise HTTPException(status_code=401, detail="No GitHub access token in session")

    url = f"https://api.github.com/repos/{owner}/{repo}/contents/{path}"
    params = {}
    if ref:
        params["ref"] = ref

    data = await asyncio.to_thread(_gh_get, token, url, params)
    if data is None:
        raise HTTPException(status_code=404, detail="Path not found in repository")

    # GitHub returns a list for directories, a dict for files
    if isinstance(data, dict):
        return {"type": "file", "item": data}

    items = sorted(data, key=lambda x: (0 if x["type"] == "dir" else 1, x["name"].lower()))
    return {
        "type": "directory",
        "path": path,
        "items": [
            {
                "name": item["name"],
                "path": item["path"],
                "type": item["type"],   # "file" | "dir"
                "size": item.get("size", 0),
                "sha": item["sha"],
                "url": item.get("html_url", ""),
            }
            for item in items
        ]
    }


@router.get("/{owner}/{repo}/file")
async def get_file_content(
    owner: str, repo: str,
    path: str = Query(..., description="File path in repo"),
    ref: str = Query(default=""),
    session: Dict[str, Any] = Depends(get_required_github_session),
):
    """Return decoded file content and metadata."""
    token = session.get("access_token", "")
    if not token:
        raise HTTPException(status_code=401, detail="No GitHub access token in session")

    url = f"https://api.github.com/repos/{owner}/{repo}/contents/{path}"
    params = {}
    if ref:
        params["ref"] = ref

    data = await asyncio.to_thread(_gh_get, token, url, params)
    if data is None:
        raise HTTPException(status_code=404, detail="File not found")

    if isinstance(data, list):
        raise HTTPException(status_code=400, detail="Path is a directory, not a file")

    import base64
    content_raw = data.get("content", "")
    try:
        # GitHub returns base64-encoded content with newlines
        decoded = base64.b64decode(content_raw.replace("\n", "")).decode("utf-8", errors="replace")
    except Exception:
        decoded = ""

    return {
        "name": data["name"],
        "path": data["path"],
        "content": decoded,
        "size": data.get("size", 0),
        "sha": data["sha"],
        "encoding": data.get("encoding", "base64"),
        "html_url": data.get("html_url", ""),
    }


# ── Commit history ────────────────────────────────────────────────────────────

@router.get("/{owner}/{repo}/commits")
async def get_commits(
    owner: str, repo: str,
    branch: str = Query(default=""),
    path: str = Query(default="", description="Filter commits that touch this path"),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=30, ge=1, le=100),
    session: Dict[str, Any] = Depends(get_required_github_session),
):
    """Return paginated commit history for a repo."""
    token = session.get("access_token", "")
    if not token:
        raise HTTPException(status_code=401, detail="No GitHub access token in session")

    url = f"https://api.github.com/repos/{owner}/{repo}/commits"
    params = {"page": page, "per_page": per_page}
    if branch:
        params["sha"] = branch
    if path:
        params["path"] = path

    data = await asyncio.to_thread(_gh_get, token, url, params)
    if data is None:
        raise HTTPException(status_code=404, detail="Repository or branch not found")

    return [
        {
            "sha": c["sha"],
            "short_sha": c["sha"][:7],
            "message": c["commit"]["message"].split("\n")[0],   # first line only
            "full_message": c["commit"]["message"],
            "author": {
                "name": c["commit"]["author"]["name"],
                "email": c["commit"]["author"]["email"],
                "login": (c.get("author") or {}).get("login"),
                "avatar_url": (c.get("author") or {}).get("avatar_url"),
            },
            "date": c["commit"]["author"]["date"],
            "html_url": c["html_url"],
        }
        for c in data
    ]


@router.get("/{owner}/{repo}/commits/{sha}")
async def get_commit_detail(
    owner: str, repo: str, sha: str,
    session: Dict[str, Any] = Depends(get_required_github_session),
):
    """Return full detail for a single commit including files changed."""
    token = session.get("access_token", "")
    if not token:
        raise HTTPException(status_code=401, detail="No GitHub access token in session")

    url = f"https://api.github.com/repos/{owner}/{repo}/commits/{sha}"
    data = await asyncio.to_thread(_gh_get, token, url)
    if data is None:
        raise HTTPException(status_code=404, detail="Commit not found")

    return {
        "sha": data["sha"],
        "short_sha": data["sha"][:7],
        "message": data["commit"]["message"],
        "author": {
            "name": data["commit"]["author"]["name"],
            "email": data["commit"]["author"]["email"],
            "login": (data.get("author") or {}).get("login"),
            "avatar_url": (data.get("author") or {}).get("avatar_url"),
        },
        "date": data["commit"]["author"]["date"],
        "html_url": data["html_url"],
        "stats": data.get("stats", {}),
        "files": [
            {
                "filename": f["filename"],
                "status": f["status"],
                "additions": f["additions"],
                "deletions": f["deletions"],
                "changes": f["changes"],
                "patch": f.get("patch", ""),
            }
            for f in data.get("files", [])
        ],
    }


# ── Branches ─────────────────────────────────────────────────────────────────

@router.get("/{owner}/{repo}/branches")
async def get_branches(
    owner: str, repo: str,
    session: Dict[str, Any] = Depends(get_required_github_session),
):
    token = session.get("access_token", "")
    if not token:
        raise HTTPException(status_code=401, detail="No GitHub access token in session")

    url = f"https://api.github.com/repos/{owner}/{repo}/branches"
    data = await asyncio.to_thread(_gh_get, token, url, {"per_page": 100})
    if data is None:
        return []
    return [{"name": b["name"], "sha": b["commit"]["sha"]} for b in data]
