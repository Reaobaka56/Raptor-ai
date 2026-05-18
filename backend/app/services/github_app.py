from fastapi import APIRouter, Request
from fastapi.responses import RedirectResponse
import os
import requests

router = APIRouter()

@router.get("/auth/github/callback")
async def github_callback(request: Request):
    code = request.query_params.get("code")

    if not code:
        return {"error": "Missing code"}

    # Exchange code for access token
    token_res = requests.post(
        "https://github.com/login/oauth/access_token",
        headers={"Accept": "application/json"},
        data={
            "client_id": os.getenv("GITHUB_CLIENT_ID"),
            "client_secret": os.getenv("GITHUB_CLIENT_SECRET"),
            "code": code,
        },
        timeout=10
    )

    token_data = token_res.json()
    access_token = token_data.get("access_token")

    if not access_token:
        return {
            "error": "OAuth failed",
            "details": token_data
        }

    # Get GitHub user
    user_res = requests.get(
        "https://api.github.com/user",
        headers={
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/vnd.github+json"
        },
        timeout=10
    )

    user = user_res.json()

    print("GitHub login:", user.get("login"))

    # Redirect to frontend dashboard
    return RedirectResponse(url="https://raptor-agent-ai.vercel.app/dashboard")
