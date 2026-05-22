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
  const errorMsg = params.get("error");

  // Handle error returned from backend
  if (errorMsg) {
    setError(errorMsg);
    setLoading(false);
    setTimeout(() => navigate("/"), 3000);
    return;
  }

  // If we have an OAuth code, exchange it for token/user info
  if (code) {
    // Optional: verify state matches sessionStorage to prevent CSRF
    const savedState = sessionStorage.getItem('github_oauth_state');
    if (state && savedState && state !== savedState) {
      setError('Invalid OAuth state. Please try logging in again.');
      setLoading(false);
      setTimeout(() => navigate('/'), 3000);
      return;
    }

    // Call backend to complete login
    authApi.completeGithubLogin(code)
      .then((response) => {
        const data = response.data;
        // Store token and user info
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        window.dispatchEvent(new Event('auth-change'));
        navigate('/dashboard', { replace: true });
      })
      .catch((err) => {
        const msg = err?.response?.data?.detail || err.message || 'Authentication failed';
        setError(msg);
        setTimeout(() => navigate('/'), 3000);
      })
      .finally(() => {
        setLoading(false);
      });
    return; // exit early; async handling will manage loading state
  }

  // No code and no error: something went wrong
  setError('Missing authentication data. Please try logging in again.');
  setLoading(false);
  setTimeout(() => navigate('/'), 3000);
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
