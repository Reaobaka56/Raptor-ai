from flask import Flask, request, redirect
import os
import requests

app = Flask(__name__)

@app.route("/auth/github/callback")
def github_callback():
    code = request.args.get("code")

    if not code:
        return {"error": "Missing code"}, 400

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
            "error": "Failed to get access token",
            "details": token_data
        }, 400

    # Fetch GitHub user
    user_res = requests.get(
        "https://api.github.com/user",
        headers={
            "Authorization": f"Bearer {access_token}"
        },
        timeout=10
    )

    user = user_res.json()

    # DEBUG: print or store user
    print("GitHub user:", user["login"])

    # Redirect to frontend
    return redirect("https://raptor-agent-ai.vercel.app/dashboard")
