import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, List, BarChart3, Menu, X, Github,
  LogOut, BookOpen, Compass, Users, Calendar
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { TRexIcon } from './TRexIcon'
import { startGithubLogin, type UserProfile } from '../api'

interface LayoutProps { children: React.ReactNode }

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/reviews',   label: 'Reviews',   icon: List },
  { path: '/analytics', label: 'Analytics', icon: BarChart3 },
  { path: '/rules',     label: 'Rules',     icon: BookOpen },
  { path: '/onboarding',label: 'Onboarding',icon: Compass },
  { path: '/teams',     label: 'Teams',     icon: Users },
  { path: '/calendar',  label: 'Calendar',  icon: Calendar },
]

export default function Layout({ children }: LayoutProps) {
  const location  = useLocation()
  const navigate  = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [user, setUser] = useState<UserProfile | null>(null)
  const [isLoggingIn, setIsLoggingIn] = useState(false)

  useEffect(() => {
    const checkAuth = () => {
      const storedUser = localStorage.getItem('user')
      if (storedUser) {
        try { setUser(JSON.parse(storedUser)) }
        catch { localStorage.removeItem('user') }
      } else { setUser(null) }
    }
    checkAuth()
    window.addEventListener('auth-change', checkAuth)
    return () => window.removeEventListener('auth-change', checkAuth)
  }, [])

  const handleGithubLogin = async () => {
    if (isLoggingIn) return
    setIsLoggingIn(true)
    try { await startGithubLogin() }
    catch { setIsLoggingIn(false); navigate('/auth/error') }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
    window.dispatchEvent(new Event('auth-change'))
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-black text-gray-300 font-sans selection:bg-white/20 selection:text-white flex flex-col">
      {/* ── Top nav ── */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/90 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            {/* Logo */}
            <Link to="/dashboard" className="flex items-center gap-2.5 group shrink-0">
              <TRexIcon className="h-7 w-7 text-white" />
              <span className="text-base font-bold tracking-tight text-white">Raptor AI</span>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map(({ path, label, icon: Icon }) => {
                const active = location.pathname === path
                return (
                  <Link key={path} to={path}
                    className={`flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs font-semibold transition-all ${
                      active
                        ? 'border-white bg-white text-black'
                        : 'border-transparent text-gray-400 hover:border-white/20 hover:text-white'
                    }`}>
                    <Icon className="h-3.5 w-3.5" />{label}
                  </Link>
                )
              })}
            </nav>

            {/* Desktop auth */}
            <div className="hidden md:flex items-center gap-2 shrink-0">
              {user ? (
                <>
                  <div className="flex items-center gap-2 rounded border border-white/10 px-3 py-1.5">
                    <img src={user.avatarUrl} alt={user.username}
                      className="h-5 w-5 rounded-full border border-white/20 object-cover" />
                    <span className="text-xs font-semibold text-white">{user.username}</span>
                  </div>
                  <button onClick={handleLogout}
                    className="flex items-center gap-1.5 rounded border border-white/10 px-3 py-1.5 text-xs font-semibold text-gray-400 hover:border-white/30 hover:text-white transition-all">
                    <LogOut className="h-3.5 w-3.5" /> Sign Out
                  </button>
                </>
              ) : (
                <button onClick={handleGithubLogin} disabled={isLoggingIn}
                  className="flex items-center gap-2 rounded border border-white bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-gray-100 disabled:opacity-60 transition-all">
                  <Github className="h-4 w-4" />
                  {isLoggingIn ? 'Connecting…' : 'Login with GitHub'}
                </button>
              )}
            </div>

            {/* Mobile hamburger */}
            <button className="md:hidden rounded border border-white/10 p-2 text-gray-400 hover:text-white transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/10 bg-black px-4 py-4 space-y-1">
            {navItems.map(({ path, label, icon: Icon }) => {
              const active = location.pathname === path
              return (
                <Link key={path} to={path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-2.5 rounded border px-4 py-2.5 text-sm font-semibold transition-all ${
                    active
                      ? 'border-white bg-white text-black'
                      : 'border-transparent text-gray-400 hover:border-white/20 hover:text-white'
                  }`}>
                  <Icon className="h-4 w-4" />{label}
                </Link>
              )
            })}
            <div className="pt-3 border-t border-white/10">
              {user ? (
                <div className="flex items-center justify-between rounded border border-white/10 p-3">
                  <div className="flex items-center gap-2">
                    <img src={user.avatarUrl} alt={user.username} className="h-7 w-7 rounded-full border border-white/20" />
                    <span className="text-sm font-semibold text-white">{user.username}</span>
                  </div>
                  <button onClick={handleLogout}
                    className="rounded border border-white/10 px-3 py-1 text-xs font-semibold text-gray-400 hover:text-white transition-all">
                    Sign Out
                  </button>
                </div>
              ) : (
                <button onClick={() => { setMobileMenuOpen(false); handleGithubLogin() }}
                  disabled={isLoggingIn}
                  className="flex w-full items-center justify-center gap-2 rounded border border-white bg-white py-2.5 text-sm font-semibold text-black hover:bg-gray-100 disabled:opacity-60 transition-all">
                  <Github className="h-4 w-4" />
                  {isLoggingIn ? 'Connecting…' : 'Login with GitHub'}
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      {/* ── Page content ── */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* ── Footer ── */}
      <footer className="border-t-0 bg-black px-6 py-8 mt-auto">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <TRexIcon className="h-5 w-5 text-white" />
            <span className="text-sm font-bold text-white">Raptor AI</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-gray-600">
            <Link to="/docs" className="hover:text-white transition-colors">Docs</Link>
            <Link to="/blog" className="hover:text-white transition-colors">Blog</Link>
            <Link to="/privacy" className="hover:text-white transition-colors">Privacy</Link>
            <Link to="/terms" className="hover:text-white transition-colors">Terms</Link>
          </div>
          <p className="text-xs text-gray-700">© 2026 Raptor AI · Cape Town, SA</p>
        </div>
      </footer>
    </div>
  )
}
