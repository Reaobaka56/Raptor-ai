import os
import requests
from typing import Dict, Any

class GitHubAppService:
    def __init__(self):
        self.client_id = os.getenv("GITHUB_CLIENT_ID")
        self.client_secret = os.getenv("GITHUB_CLIENT_SECRET")
        # Base URLs for GitHub REST interactions
        self.base_url = "https://api.github.com"

    def process_webhook_payload(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Processes incoming payload data from live GitHub App webhooks 
        (e.g., pull_request event triggers).
        """
        event_type = payload.get("action")
        repo_name = payload.get("repository", {}).get("full_name")
        
        # Add background processing or analysis logic here
        return {
            "processed": True,
            "repo": repo_name,
            "event": event_type
        }

    def post_pr_comment(self, repo_full_name: str, pr_number: int, comment_body: str, token: str) -> bool:
        """
        Posts code review results or automated comments directly onto a GitHub PR.
        """
        url = f"{self.base_url}/repos/{repo_full_name}/issues/{pr_number}/comments"
        headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json"
        }
        
        try:
            res = requests.post(url, json={"body": comment_body}, headers=headers, timeout=10)
            return res.status_code == 201
        except requests.RequestException:
            return False

# =====================================================================
# CRITICAL EXPORT
# This instantiates the exact object name expected by main.py line 30
# =====================================================================
github_app_service = GitHubAppService()
