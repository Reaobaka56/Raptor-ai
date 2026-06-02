import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import axios from 'axios'

export default function AuthCallback() {
  const [params] = useSearchParams()
  const navigate = useNavigate()

  useEffect(() => {
    const code = params.get('code')
    const state = params.get('state')

    if (!code) {
      navigate('/')
      return
    }

    const exchangeCode = async () => {
      try {
        // FIXED: Combined params and withCredentials into a single config object
        const res = await axios.get(
          `${import.meta.env.VITE_API_URL}/api/auth/github/callback`,
          { 
            params: { code, state },
            withCredentials: true 
          }
        )

        // backend sets cookie, but we can also store user if returned later
        localStorage.setItem('auth', 'true')

        navigate('/dashboard')
      } catch (err) {
        console.error('OAuth failed', err)
        navigate('/')
      }
    }

    exchangeCode()
  }, [params, navigate])

  return (
    <div className="text-white p-10 font-mono">
      Completing GitHub login...
    </div>
  )
}
