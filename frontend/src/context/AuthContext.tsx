import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { UserProfile } from '../api'

interface AuthContextValue {
  user: UserProfile | null
  token: string | null
  isAuthenticated: boolean
  /** True only until the initial read from localStorage completes. Guards
   * against route guards / nav deciding "not authenticated" before auth
   * state has actually been loaded. */
  isLoading: boolean
  login: (token: string, user: UserProfile) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

function readStoredUser(): UserProfile | null {
  const raw = localStorage.getItem('user')
  if (!raw) return null
  try {
    return JSON.parse(raw) as UserProfile
  } catch {
    localStorage.removeItem('user')
    return null
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Initial load. Reading localStorage is synchronous, but this still runs
  // as an effect (not during render) so it happens after mount, same as
  // every other consumer — avoids server/client or first-paint mismatches.
  useEffect(() => {
    setToken(localStorage.getItem('token'))
    setUser(readStoredUser())
    setIsLoading(false)
  }, [])

  // Stay in sync with logout/login triggered outside React (the axios
  // interceptor on a 401, or another tab).
  useEffect(() => {
    const sync = () => {
      setToken(localStorage.getItem('token'))
      setUser(readStoredUser())
    }
    window.addEventListener('auth-change', sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener('auth-change', sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const login = useCallback((newToken: string, newUser: UserProfile) => {
    localStorage.setItem('token', newToken)
    localStorage.setItem('user', JSON.stringify(newUser))
    setToken(newToken)
    setUser(newUser)
    window.dispatchEvent(new Event('auth-change'))
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setToken(null)
    setUser(null)
    window.dispatchEvent(new Event('auth-change'))
  }, [])

  const value: AuthContextValue = {
    user,
    token,
    isAuthenticated: !!token && !!user,
    isLoading,
    login,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
