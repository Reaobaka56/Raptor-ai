import os
from typing import Tuple, Optional

def parse_github_scan_target(target: str) -> Tuple[str, Optional[int]]:
    """
    Parses a scan target string into (repo_full_name, pr_number_or_None).
    Raises ValueError on unparseable input.
    """
    target = target.strip()
    
    # Strip protocols and domains
    if target.startswith("git@github.com:"):
        target = target[len("git@github.com:"):]
    elif target.startswith("https://github.com/"):
        target = target[len("https://github.com/"):]
    elif target.startswith("http://github.com/"):
        target = target[len("http://github.com/"):]
        
    # Strip .git suffix if present
    if target.endswith(".git"):
        target = target[:-len(".git")]
        
    # Check for #123
    if "#" in target:
        parts = target.split("#")
        if len(parts) == 2 and parts[1].isdigit():
            repo_parts = parts[0].split("/")
            if len(repo_parts) == 2:
                return parts[0], int(parts[1])
                
    # Check for /pull/123
    if "/pull/" in target:
        parts = target.split("/pull/")
        if len(parts) == 2:
            sub_parts = parts[1].split("/")
            if sub_parts[0].isdigit():
                repo_parts = parts[0].split("/")
                if len(repo_parts) == 2:
                    return parts[0], int(sub_parts[0])
                    
    # Check for simple owner/repo
    parts = target.split("/")
    if len(parts) == 2:
        return target, None
        
    raise ValueError(f"Unparseable GitHub target: {target}")

def get_github_auth_headers(token: Optional[str] = None) -> dict:
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers

def get_configured_github_token() -> Optional[str]:
    return os.getenv("GITHUB_TOKEN") or os.getenv("GITHUB_PAT")
