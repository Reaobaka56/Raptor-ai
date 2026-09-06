import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { POST_LOGIN_REDIRECT_KEY } from '../api'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  // Auth state hasn't finished loading yet — render nothing rather than
  // guessing "not authenticated" and bouncing a genuinely logged-in user.
  if (isLoading) return null

  if (!isAuthenticated) {
    // Remember where they were headed so login can return them here,
    // instead of always landing on the dashboard or the homepage.
    sessionStorage.setItem(POST_LOGIN_REDIRECT_KEY, location.pathname + location.search)
    return <Navigate to="/" state={{ from: location }} replace />
  }

  return <>{children}</>
}
