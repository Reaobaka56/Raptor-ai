import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { authApi } from '../api'

export default function GithubCallback() {
  const [searchParams] = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const savedState = sessionStorage.getItem('github_oauth_state')

    if (!code || !state || !savedState) {
      setError('Missing GitHub callback parameters. Please try again.')
      return
    }

    if (state !== savedState) {
      setError('GitHub state validation failed. Please retry login.')
      return
    }

    const redirectUri = `${window.location.origin}/auth/github/callback`

    const completeLogin = async () => {
      try {
        const res = await authApi.completeGithubLogin(code, state, redirectUri)
        localStorage.setItem('token', res.data.token)
        localStorage.setItem('user', JSON.stringify(res.data.user))
        sessionStorage.removeItem('github_oauth_state')
        window.dispatchEvent(new Event('auth-change'))
        navigate('/dashboard', { replace: true })
      } catch (err) {
        console.error('GitHub callback failed', err)
        setError('Unable to complete GitHub login. Please try again.')
      }
    }

    completeLogin()
  }, [navigate, searchParams])

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-6 py-24">
      <div className="max-w-xl w-full text-center space-y-6">
        <h1 className="text-3xl font-semibold">Finishing GitHub sign-in</h1>
        {error ? (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-left space-y-4">
            <p className="text-sm text-red-300">{error}</p>
            <div className="flex flex-col gap-3 sm:flex-row justify-center">
              <Link
                to="/"
                className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Back to home
              </Link>
              <Link
                to="/dashboard"
                className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
              >
                Try login again
              </Link>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-300">Please wait while we complete your GitHub login.</p>
        )}
      </div>
    </div>
  )
}
