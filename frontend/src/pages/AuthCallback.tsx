import { useEffect, useState } from "react"
import { useSearchParams, useNavigate } from "react-router-dom"
import { AlertTriangle } from "lucide-react"
import { completeGithubLogin } from "../api"

export default function AuthCallback() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleAuth = async () => {
      const code = params.get("code")
      const state = params.get("state")

      if (!code) {
        setError('No code returned from GitHub.')
        setLoading(false)
        setTimeout(() => navigate('/'), 3000)
        return
      }

      const savedState = localStorage.getItem('github_oauth_state')
      if (!state || state !== savedState) {
        setError('Invalid OAuth state. Please try logging in again.')
        setLoading(false)
        setTimeout(() => navigate('/'), 3000)
        return
      }
      localStorage.removeItem('github_oauth_state')

      try {
        const { data } = await completeGithubLogin(code, state)
        localStorage.setItem('token', data.token)
        localStorage.setItem('user', JSON.stringify(data.user))
        window.dispatchEvent(new Event('auth-change'))
        navigate('/dashboard', { replace: true })
      } catch (err: any) {
        setError(err.response?.data?.detail || err.message || 'Authentication failed')
        setLoading(false)
        setTimeout(() => navigate('/'), 3000)
      } finally {
        setLoading(false)
      }
    }

    handleAuth()
  }, [])

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

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="text-center max-w-md">
          <div className="mb-6">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          </div>
          <h1 className="text-2xl font-bold text-red-500 mb-3">Authentication Failed</h1>
          <p className="text-slate-300 mb-6">{error}</p>
          <p className="text-slate-400 text-sm">Redirecting to home in a few seconds...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-white">Processing...</h1>
      </div>
    </div>
  )
}
