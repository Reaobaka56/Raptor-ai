"""
Repository router — fetch repo tree and commits from GitHub API.
"""
import httpx
from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query

from .auth_dependencies import get_required_github_session
from .github_utils import get_github_auth_headers

router = APIRouter(prefix="/api/repos", tags=["Repositories"])

@router.get("/{owner}/{repo}/tree")
async def get_repo_tree(
    owner: str,
    repo: str,
    branch: str = "main",
    session: Dict[str, Any] = Depends(get_required_github_session)
):
    """Fetch the full file tree for a repository."""
    token = session.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="GitHub token missing")

    url = f"https://api.github.com/repos/{owner}/{repo}/git/trees/{branch}?recursive=1"
    headers = get_github_auth_headers(token)

    async with httpx.AsyncClient() as client:
        r = await client.get(url, headers=headers)
        if r.status_code == 404:
            # Fallback to 'master' if 'main' is not found
            if branch == "main":
                url = f"https://api.github.com/repos/{owner}/{repo}/git/trees/master?recursive=1"
                r = await client.get(url, headers=headers)
        
        if r.status_code != 200:
            raise HTTPException(status_code=r.status_code, detail=f"Failed to fetch tree: {r.text}")
        
        return r.json()


@router.get("/{owner}/{repo}/contents/{path:path}")
async def get_repo_file_content(
    owner: str,
    repo: str,
    path: str,
    branch: str = "main",
    session: Dict[str, Any] = Depends(get_required_github_session)
):
    """Fetch the content of a specific file."""
    token = session.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="GitHub token missing")

    url = f"https://api.github.com/repos/{owner}/{repo}/contents/{path}?ref={branch}"
    headers = get_github_auth_headers(token)

    async with httpx.AsyncClient() as client:
        r = await client.get(url, headers=headers)
        if r.status_code == 404 and branch == "main":
            # Fallback to 'master'
            url = f"https://api.github.com/repos/{owner}/{repo}/contents/{path}?ref=master"
            r = await client.get(url, headers=headers)
            
        if r.status_code != 200:
            raise HTTPException(status_code=r.status_code, detail=f"Failed to fetch file content: {r.text}")
            
        return r.json()


@router.get("/{owner}/{repo}/commits")
async def get_repo_commits(
    owner: str,
    repo: str,
    per_page: int = Query(30, ge=1, le=100),
    session: Dict[str, Any] = Depends(get_required_github_session)
):
    """Fetch the latest commits for a repository."""
    token = session.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="GitHub token missing")

    url = f"https://api.github.com/repos/{owner}/{repo}/commits?per_page={per_page}"
    headers = get_github_auth_headers(token)

    async with httpx.AsyncClient() as client:
        r = await client.get(url, headers=headers)
        if r.status_code != 200:
            raise HTTPException(status_code=r.status_code, detail=f"Failed to fetch commits: {r.text}")
            
        return r.json()
