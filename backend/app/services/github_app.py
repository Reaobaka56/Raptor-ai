import os
import time
import requests
from typing import Optional, Dict, Any
import jwt

class GitHubAppService:
    def _get_app_jwt(self) -> Optional[str]:
        app_id = os.getenv("GITHUB_APP_ID")
        private_key = os.getenv("GITHUB_APP_PRIVATE_KEY")
        
        if not app_id or not private_key:
            return None
            
        now = int(time.time())
        payload = {
            "iat": now - 60,
            "exp": now + 600,
            "iss": str(app_id)
        }
        
        try:
            # Handle potential escaped newlines in env variables
            cleaned_key = private_key.replace("\\n", "\n")
            encoded = jwt.encode(payload, cleaned_key, algorithm="RS256")
            return encoded
        except Exception as e:
            print(f"Error encoding GitHub App JWT: {e}")
            return None

    def get_installation_token(self, installation_id: int) -> Optional[str]:
        app_jwt = self._get_app_jwt()
        if not app_jwt:
            return os.getenv("GITHUB_TOKEN") # Fallback to personal token if app not fully configured
            
        url = f"https://api.github.com/app/installations/{installation_id}/access_tokens"
        headers = {
            "Authorization": f"Bearer {app_jwt}",
            "Accept": "application/vnd.github.v3+json"
        }
        
        try:
            res = requests.post(url, headers=headers, timeout=10)
            if res.status_code == 201:
                return res.json().get("token")
        except Exception as e:
            print(f"Failed to obtain installation access token: {e}")
            
        return os.getenv("GITHUB_TOKEN")

    def fetch_pr_diff(self, repo: str, pr_number: int, installation_id: Optional[int] = None) -> Optional[str]:
        token = self.get_installation_token(installation_id or 1) if installation_id else os.getenv("GITHUB_TOKEN")
        if not token:
            return None
            
        url = f"https://api.github.com/repos/{repo}/pulls/{pr_number}"
        headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github.v3.diff"
        }
        
        try:
            res = requests.get(url, headers=headers, timeout=15)
            if res.status_code == 200:
                return res.text
        except Exception as e:
            print(f"Failed to fetch PR diff for {repo} #{pr_number}: {e}")
            
        return None

    def post_pr_review_comment(self, repo: str, pr_number: int, markdown_body: str, installation_id: Optional[int] = None) -> bool:
        token = self.get_installation_token(installation_id or 1) if installation_id else os.getenv("GITHUB_TOKEN")
        if not token:
            print("No GitHub token available to post PR review.")
            return False
            
        url = f"https://api.github.com/repos/{repo}/issues/{pr_number}/comments"
        headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github.v3+json",
            "Content-Type": "application/json"
        }
        payload = {"body": markdown_body}
        
        try:
            res = requests.post(url, headers=headers, json=payload, timeout=10)
            return res.status_code == 201
        except Exception as e:
            print(f"Failed to post comment to {repo} #{pr_number}: {e}")
            return False

github_app_service = GitHubAppService()
