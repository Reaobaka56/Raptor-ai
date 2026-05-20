import { useEffect } from "react"
import { useSearchParams, useNavigate } from "react-router-dom"
import axios from "axios"

export default function AuthCallback() {
  const [params] = useSearchParams()
  const navigate = useNavigate()

  useEffect(() => {
    const code = params.get("code")
    const state = params.get("state")

    if (!code) {
      navigate("/")
      return
    }

    const login = async () => {
      try {
        await axios.get(
          `${import.meta.env.VITE_API_URL}/api/auth/github/callback`,
          {
            params: { code, state },
            withCredentials: true
          }
        )

        navigate("/dashboard")
      } catch (err) {
        console.error(err)
        navigate("/")
      }
    }

    login()
  }, [])

  return (
    <div className="text-white font-mono p-10">
      Logging you in via GitHub...
    </div>
  )
}
