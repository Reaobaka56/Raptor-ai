import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import axios from 'axios'

export default function AuthCallback() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const code = params.get('code')
    const state = params.get('state')

    if (!code) {
      setError('No code found in URL params.')
      setTimeout(() => navigate('/'), 3000)
      return
    }

    const exchangeCode = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'

        // POST to backend exchange endpoint — NOT the callback URL
        const res = await axios.post(
          `${apiUrl}/api/auth/github`,
          { code, state },
          { withCredentials: true }
        )

        // Store real token + user data
        localStorage.setItem('token', res.data.token)
        localStorage.setItem('user', JSON.stringify(res.data.user))
        window.dispatchEvent(new Event('auth-change'))

        navigate('/dashboard', { replace: true })
      } catch (err: any) {
        console.error('OAuth failed', err)
        setError(err.response?.data?.detail || err.message || 'OAuth exchange failed')
        setTimeout(() => navigate('/'), 3000)
      }
    }

    exchangeCode()
  }, []) // empty deps — run once only

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-900 text-white p-10 font-mono">
      {error ? (
        <div className="text-red-400 border border-red-500/30 bg-red-500/10 p-4 rounded-lg max-w-md text-center">
          <p className="font-bold mb-2">❌ Authentication Error</p>
          <p className="text-sm">{error}</p>
          <p className="text-xs text-gray-400 mt-4">Redirecting home...</p>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
          <span>Completing GitHub login...</span>
        </div>
      )}
    </div>
  )
}
