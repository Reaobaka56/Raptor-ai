import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Github } from 'lucide-react'
import { authApi } from '../api'

export default function GithubCallback() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const completeLogin = async () => {
      const code = searchParams.get('code')
      const returnedState = searchParams.get('state')
      const expectedState = sessionStorage.getItem('github_oauth_state')
      sessionStorage.removeItem('github_oauth_state')

      if (!code || !returnedState || !expectedState || returnedState !== expectedState) {
        setError('GitHub sign-in could not be verified. Please try connecting again.')
        return
      }

      try {
        const res = await authApi.completeGithubLogin(code)
        localStorage.setItem('token', res.data.token)
        localStorage.setItem('user', JSON.stringify(res.data.user))
        window.dispatchEvent(new Event('auth-change'))
        navigate('/dashboard', { replace: true })
      } catch (err) {
        console.error('GitHub authentication failed', err)
        setError('GitHub sign-in failed. Please try connecting again.')
      }
    }

    completeLogin()
  }, [navigate, searchParams])

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-6 font-sans">
      <div className="max-w-md w-full border border-white/10 rounded-xl p-8 bg-white/5 text-center space-y-5">
        <Github className="w-10 h-10 mx-auto" />
        {error ? (
          <>
            <h1 className="text-xl font-bold">Unable to connect GitHub</h1>
            <p className="text-sm text-gray-400">{error}</p>
            <Link to="/dashboard" className="inline-flex bg-white text-black px-4 py-2 rounded text-xs font-bold">
              Back to Dashboard
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold">Completing GitHub sign-in…</h1>
            <p className="text-sm text-gray-400">Verifying that this browser started the OAuth request.</p>
          </>
        )}
      </div>
    </div>
  )
}
