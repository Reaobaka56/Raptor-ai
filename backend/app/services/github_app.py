import base64
import os
import time
from typing import Any, Dict, List

import jwt
import requests


class GitHubAppService:
    def __init__(self):
        self.app_id = os.getenv("GITHUB_APP_ID")
        self.client_id = os.getenv("GITHUB_CLIENT_ID")
        self.client_secret = os.getenv("GITHUB_CLIENT_SECRET")
        self.private_key = (os.getenv("GITHUB_PRIVATE_KEY") or "").replace("\\n", "\n")
        self.base_url = "https://api.github.com"

    def process_webhook_payload(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Process live GitHub App webhook payload metadata."""
        event_type = payload.get("action")
        repo_name = payload.get("repository", {}).get("full_name")
        return {"processed": True, "repo": repo_name, "event": event_type}

    def post_pr_comment(self, repo_full_name: str, pr_number: int, comment_body: str, token: str) -> bool:
        """Post code review results directly onto a GitHub PR."""
        url = f"{self.base_url}/repos/{repo_full_name}/issues/{pr_number}/comments"
        res = requests.post(url, json={"body": comment_body}, headers=self._headers(token), timeout=15)
        return res.status_code == 201

    def create_fix_pull_request(self, review: Any) -> Dict[str, Any]:
        """Create a real remediation PR through the installed GitHub App."""
        token = self.get_installation_token_for_repo(review.githubRepo)
        repo = self._get_json(f"/repos/{review.githubRepo}", token)
        default_branch = repo.get("default_branch") or "main"
        base_ref = self._get_json(f"/repos/{review.githubRepo}/git/ref/heads/{default_branch}", token)
        base_sha = base_ref["object"]["sha"]

        branch_name = f"raptor/fix-review-{review.id}"
        ref_url = f"/repos/{review.githubRepo}/git/refs"
        try:
            self._post_json(ref_url, token, {"ref": f"refs/heads/{branch_name}", "sha": base_sha})
        except requests.HTTPError as exc:
            if exc.response is None or exc.response.status_code != 422:
                raise

        remediation_path = f"raptor-remediation/review-{review.id}.md"
        body = self._build_remediation_markdown(review)
        content = base64.b64encode(body.encode("utf-8")).decode("ascii")
        existing_sha = self._get_existing_file_sha(review.githubRepo, remediation_path, branch_name, token)
        payload: Dict[str, Any] = {
            "message": f"Add Raptor remediation plan for review {review.id}",
            "content": content,
            "branch": branch_name,
        }
        if existing_sha:
            payload["sha"] = existing_sha
        self._put_json(f"/repos/{review.githubRepo}/contents/{remediation_path}", token, payload)

        pr_payload = {
            "title": f"Raptor remediation for review #{review.id}",
            "head": branch_name,
            "base": default_branch,
            "body": body,
        }
        pr = self._post_json(f"/repos/{review.githubRepo}/pulls", token, pr_payload)
        return {"number": pr["number"], "html_url": pr["html_url"]}

    def get_installation_token_for_repo(self, repo_full_name: str) -> str:
        if not self.app_id or not self.private_key:
            raise RuntimeError("GitHub App credentials are not configured")
        app_jwt = self._app_jwt()
        installation = self._get_json(f"/repos/{repo_full_name}/installation", app_jwt)
        installation_id = installation["id"]
        token_response = self._post_json(f"/app/installations/{installation_id}/access_tokens", app_jwt, {})
        return token_response["token"]

    def _app_jwt(self) -> str:
        now = int(time.time())
        payload = {"iat": now - 60, "exp": now + 540, "iss": self.app_id}
        return jwt.encode(payload, self.private_key, algorithm="RS256")

    def _headers(self, token: str) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }

    def _get_json(self, path: str, token: str) -> Dict[str, Any]:
        res = requests.get(f"{self.base_url}{path}", headers=self._headers(token), timeout=15)
        res.raise_for_status()
        return res.json()

    def _post_json(self, path: str, token: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        res = requests.post(f"{self.base_url}{path}", json=payload, headers=self._headers(token), timeout=15)
        res.raise_for_status()
        return res.json()

    def _put_json(self, path: str, token: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        res = requests.put(f"{self.base_url}{path}", json=payload, headers=self._headers(token), timeout=15)
        res.raise_for_status()
        return res.json()

    def _get_existing_file_sha(self, repo_full_name: str, path: str, branch: str, token: str) -> str | None:
        res = requests.get(
            f"{self.base_url}/repos/{repo_full_name}/contents/{path}",
            params={"ref": branch},
            headers=self._headers(token),
            timeout=15,
        )
        if res.status_code == 404:
            return None
        res.raise_for_status()
        return res.json().get("sha")

    def _build_remediation_markdown(self, review: Any) -> str:
        issue_sections: List[str] = []
        for index, issue in enumerate(review.issues, start=1):
            issue_sections.append(
                "\n".join([
                    f"## {index}. {issue.title}",
                    f"- **File:** `{issue.file}:{issue.line}`",
                    f"- **Severity:** {issue.severity}",
                    f"- **Category:** {issue.category}",
                    f"- **Description:** {issue.description}",
                    "- **Suggested fix:**",
                    "```",
                    issue.suggestion,
                    "```",
                ])
            )
        issues = "\n\n".join(issue_sections) or "No concrete issues were detected in this scan."
        source = review.prUrl or f"https://github.com/{review.githubRepo}/pull/{review.prNumber}"
        return "\n".join([
            f"# Raptor remediation plan for {review.githubRepo} #{review.prNumber}",
            "",
            f"Source review: {source}",
            "",
            review.summary or "Raptor completed analysis for this review.",
            "",
            issues,
        ])


github_app_service = GitHubAppService()
