import { useEffect, useState } from "react"
import { useSearchParams, useNavigate } from "react-router-dom"
import { authApi } from "../api"

export default function AuthCallback() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
  const code = params.get("code");
  const state = params.get("state");

  // Verify state if needed (CSRF protection)
  const storedState = sessionStorage.getItem("github_oauth_state");
  if (state && storedState && state !== storedState) {
    setError("Invalid OAuth state. Please try logging in again.");
    setLoading(false);
    setTimeout(() => navigate("/"), 3000);
    return;
  }

  if (!code) {
    setError("No authorization code received. Please try logging in again.");
    setLoading(false);
    setTimeout(() => navigate("/"), 3000);
    return;
  }

  // Exchange code for token and user profile
  authApi
    .completeGithubLogin(code)
    .then((res) => {
      const { token, user } = res.data;
      // Store token and user info
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));
      // Notify other components
      window.dispatchEvent(new Event("auth-change"));
      navigate("/dashboard", { replace: true });
    })
    .catch((err) => {
      const errorMessage = err?.response?.data?.error || err.message || "Authentication failed";
      console.error("Auth callback error:", err);
      setError(`Authentication error: ${errorMessage}`);
      setTimeout(() => navigate("/"), 3000);
    })
    .finally(() => setLoading(false));
}, [params, navigate]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="text-center">
          <div className="mb-6">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Logging you in...</h1>
          <p className="text-slate-400">Completing your GitHub authentication</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="text-center max-w-md">
          <div className="mb-6">
            <div className="text-5xl mb-4">⚠️</div>
          </div>
          <h1 className="text-2xl font-bold text-red-500 mb-3">Authentication Failed</h1>
          <p className="text-slate-300 mb-6">{error}</p>
          <p className="text-slate-400 text-sm">Redirecting to home in a few seconds...</p>
        </div>
      </div>
    )
  }

  // Fallback (shouldn't reach here)
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-white">Processing...</h1>
      </div>
    </div>
  )
}
