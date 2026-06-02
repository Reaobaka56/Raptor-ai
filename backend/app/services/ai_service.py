import json
import os
import re
import time
from typing import Any, Dict, List

import requests
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()


def _extract_json_object(text: str) -> Dict[str, Any]:
    """Extract and parse the first JSON object returned by Gemini."""
    stripped = text.strip()
    if stripped.startswith("```json"):
        stripped = stripped.split("```json", 1)[1].split("```", 1)[0].strip()
    elif stripped.startswith("```"):
        stripped = stripped.split("```", 1)[1].split("```", 1)[0].strip()

    json_start = stripped.find("{")
    json_end = stripped.rfind("}")
    if json_start == -1 or json_end == -1 or json_end < json_start:
        raise ValueError("Gemini response did not contain a JSON object")
    return json.loads(stripped[json_start:json_end + 1])


class AIService:
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        self.model_name = os.getenv("GEMINI_MODEL", "gemini-2.5-pro")
        self.client = genai.Client(api_key=self.api_key) if self.api_key else None

    def fetch_diff(self, diff_url: str, github_token: str | None = None) -> str:
        """Fetch a raw git diff from GitHub without substituting canned examples."""
        headers = {"Accept": "application/vnd.github.diff"}
        if github_token:
            headers["Authorization"] = f"Bearer {github_token}"
        res = requests.get(diff_url, headers=headers, timeout=30)
        res.raise_for_status()
        return res.text

    def analyze_pr(self, repo: str, pr_number: int, pr_title: str, diff_text: str) -> Dict[str, Any]:
        """Run Gemini analysis over the actual PR or commit diff text."""
        start_time = time.time()
        prompt = f"""
You are Raptor, an expert security and performance AST code review agent.
Analyze the following pull request or commit diff for:
1. Security Vulnerabilities (SQL injection, auth bypass, hardcoded secrets, XSS)
2. Performance Leaks (N+1 database queries, unclosed file descriptors, blocking async loops)
3. Code Quality (duplication, missing error checking)

PR/Commit Repo: {repo}
ID: #{pr_number}
Title: {pr_title}

Git Diff Text:
```diff
{diff_text[:180000]}
```

Return your findings strictly in valid JSON format matching this schema:
{{
  "summary": "High-level summary of the review findings.",
  "issues": [
    {{
      "file": "path/to/file.py",
      "line": 42,
      "severity": "critical" | "high" | "medium" | "low",
      "category": "security" | "performance" | "quality" | "design",
      "title": "Short title",
      "description": "Detailed explanation of the vulnerability or flaw.",
      "suggestion": "Corrected code snippet replacement."
    }}
  ]
}}
"""
        if self.client:
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0,
                    response_mime_type="application/json",
                ),
            )
            data = _extract_json_object(response.text or "")
        else:
            data = self._analyze_diff_with_local_rules(repo, pr_number, diff_text)

        data["issues"] = self._normalize_issues(data.get("issues", []))
        data["reviewTimeMs"] = int((time.time() - start_time) * 1000)
        return data

    def _normalize_issues(self, issues: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        normalized = []
        allowed_severities = {"critical", "high", "medium", "low"}
        allowed_categories = {"security", "performance", "quality", "design"}
        for issue in issues:
            normalized.append({
                "file": str(issue.get("file") or "unknown"),
                "line": max(1, int(issue.get("line") or 1)),
                "severity": str(issue.get("severity") or "medium").lower()
                    if str(issue.get("severity") or "medium").lower() in allowed_severities else "medium",
                "category": str(issue.get("category") or "quality").lower()
                    if str(issue.get("category") or "quality").lower() in allowed_categories else "quality",
                "title": str(issue.get("title") or "Review finding"),
                "description": str(issue.get("description") or "Gemini identified a code review finding."),
                "suggestion": str(issue.get("suggestion") or "Review the changed code and apply the safest remediation."),
            })
        return normalized

    def _analyze_diff_with_local_rules(self, repo: str, pr_number: int, diff_text: str) -> Dict[str, Any]:
        """Use deterministic rules on the real diff when Gemini is not configured."""
        issues: List[Dict[str, Any]] = []
        current_file = "unknown"
        new_line = 0
        for raw_line in diff_text.splitlines():
            if raw_line.startswith("+++ b/"):
                current_file = raw_line.removeprefix("+++ b/")
                continue
            hunk = re.match(r"@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@", raw_line)
            if hunk:
                new_line = int(hunk.group(1)) - 1
                continue
            if raw_line.startswith("+") and not raw_line.startswith("+++"):
                new_line += 1
                added = raw_line[1:]
                lowered = added.lower()
                if re.search(r"execute\s*\(\s*f?['\"].*\{.*\}", added) or re.search(r"select .*\+", lowered):
                    issues.append({
                        "file": current_file,
                        "line": new_line,
                        "severity": "critical",
                        "category": "security",
                        "title": "Potential SQL injection in added query",
                        "description": "The added diff appears to interpolate or concatenate values into a SQL statement. Use parameterized query placeholders instead.",
                        "suggestion": "Replace string interpolation/concatenation with a parameterized query and pass user values separately.",
                    })
                if re.search(r"(api[_-]?key|secret|password|token)\s*=\s*['\"][^'\"]{8,}", lowered):
                    issues.append({
                        "file": current_file,
                        "line": new_line,
                        "severity": "high",
                        "category": "security",
                        "title": "Potential hardcoded secret",
                        "description": "The added line looks like a credential or token literal. Store secrets in environment-backed secret management instead.",
                        "suggestion": "Move the value to a secret manager or environment variable and rotate the exposed credential.",
                    })
            elif raw_line and not raw_line.startswith("-"):
                new_line += 1

        summary = (
            f"Gemini API key is not configured, so Raptor analyzed the actual diff for {repo} #{pr_number} "
            f"with deterministic local security rules and found {len(issues)} issue(s)."
        )
        return {"summary": summary, "issues": issues}


ai_service = AIService()
