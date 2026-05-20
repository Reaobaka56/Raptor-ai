from fastapi import Request

@app.get("/api/auth/github/callback")
def github_callback(
    request: Request,
    code: str = Query(None),
    state: str = Query(None),
):
    if not code:
        raise HTTPException(status_code=400, detail="Missing OAuth code")

    client_id = os.getenv("GITHUB_CLIENT_ID")
    client_secret = os.getenv("GITHUB_CLIENT_SECRET")

    if not client_id or not client_secret:
        raise HTTPException(status_code=500, detail="Missing GitHub OAuth config")

    # -----------------------------
    # 1. Exchange code for token
    # -----------------------------
    token_res = requests.post(
        "https://github.com/login/oauth/access_token",
        headers={"Accept": "application/json"},
        data={
            "client_id": client_id,
            "client_secret": client_secret,
            "code": code,
        },
        timeout=10
    )

    token_data = token_res.json()
    access_token = token_data.get("access_token")

    if not access_token:
        raise HTTPException(status_code=401, detail="OAuth token exchange failed")

    # -----------------------------
    # 2. Fetch GitHub user
    # -----------------------------
    user_res = requests.get(
        "https://api.github.com/user",
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=10
    )

    if user_res.status_code != 200:
        raise HTTPException(status_code=502, detail="GitHub user fetch failed")

    user_data = user_res.json()

    user = UserProfile(
        username=user_data["login"],
        avatarUrl=user_data["avatar_url"],
        githubId=user_data["id"]
    )

    # -----------------------------
    # 3. Build repositories
    # -----------------------------
    repositories = build_repository_list(access_token)

    # -----------------------------
    # 4. Create session
    # -----------------------------
    session_token = uuid.uuid4().hex

    USER_SESSIONS[session_token] = {
        "access_token": access_token,
        "user": user,
        "repositories": repositories,
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    # -----------------------------
    # 5. IMPORTANT FIX: cookie domain handling
    # -----------------------------
    response = RedirectResponse(url="https://raptor-agent-ai.vercel.app/dashboard")

    response.set_cookie(
        key="raptor_session",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="lax",
        path="/",
        max_age=60 * 60 * 24 * 7
    )

    return response
