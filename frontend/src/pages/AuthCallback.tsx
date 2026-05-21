import { useEffect, useState } from "react"
import { useSearchParams, useNavigate } from "react-router-dom"

export default function AuthCallback() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const token = params.get("token")
    const username = params.get("username")
    const githubId = params.get("githubId")
    const avatarUrl = params.get("avatarUrl")
    const errorParam = params.get("error")

    // Check for error from backend
    if (errorParam) {
      setError(`Authentication failed: ${errorParam}`)
      setLoading(false)
      setTimeout(() => navigate("/"), 3000)
      return
    }

    // Check if token is present
    if (!token) {
      setError("No authentication token received. Please try logging in again.")
      setLoading(false)
      setTimeout(() => navigate("/"), 3000)
      return
    }

    try {
      // Store authentication data
      localStorage.setItem("authToken", token)
      localStorage.setItem("username", username || "")
      localStorage.setItem("githubId", githubId || "")
      localStorage.setItem("avatarUrl", avatarUrl || "")
      localStorage.setItem("loggedInAt", new Date().toISOString())

      setLoading(false)
      // Redirect to dashboard
      navigate("/dashboard", { replace: true })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error"
      console.error("Auth callback error:", err)
      setError(`Authentication error: ${errorMessage}`)
      setLoading(false)
      setTimeout(() => navigate("/"), 3000)
    }
  }, [params, navigate])

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
