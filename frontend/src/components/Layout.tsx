import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  List,
  BarChart3,
  Menu,
  X,
  Github,
  LogOut,
  BookOpen,
  Compass
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { TRexIcon } from './TRexIcon'
import { startGithubLogin, type UserProfile } from '../api'

interface LayoutProps {
  children: React.ReactNode
}

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/reviews', label: 'Reviews', icon: List },
  { path: '/analytics', label: 'Analytics', icon: BarChart3 },
  { path: '/rules', label: 'Rules', icon: BookOpen },
  { path: '/onboarding', label: 'Onboarding', icon: Compass },
]

export default function Layout({ children }: LayoutProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [user, setUser] = useState<UserProfile | null>(null)
  const [isLoggingIn, setIsLoggingIn] = useState(false)


  useEffect(() => {
    const checkAuth = () => {
      const storedUser = localStorage.getItem('user')
      if (storedUser) {
        try {
          setUser(JSON.parse(storedUser))
        } catch (e) {
          localStorage.removeItem('user')
        }
      } else {
        setUser(null)
      }
    }

    checkAuth()
    window.addEventListener('auth-change', checkAuth)
    return () => window.removeEventListener('auth-change', checkAuth)
  }, [])



  const handleGithubLogin = async () => {
    if (isLoggingIn) return
    setIsLoggingIn(true)
    try {
      await startGithubLogin()
    } catch (error) {
      console.error('Failed to start GitHub login', error)
      setIsLoggingIn(false)
      navigate('/auth/error')
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
    window.dispatchEvent(new Event('auth-change'))
    navigate('/')
  }

  return (
    <div className="min-h-screen text-gray-300 font-sans selection:bg-white/20 selection:text-white" style={{ background: 'var(--clay-bg)' }}>
      {/* Header */}
      <header className="clay-nav sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Link to="/dashboard" className="flex items-center gap-3 group">
                <TRexIcon className="w-7 h-7 text-white" />
                <span className="text-lg font-bold text-white tracking-tight font-sans">Raptor</span>
              </Link>
            </div>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-1 font-sans">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = location.pathname === item.path
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wide transition-all ${
                      isActive
                        ? 'text-black'
                        : 'text-gray-400 hover:text-white hover:bg-white/[0.06]'
                    }`}
                    style={isActive ? {
                      background: 'linear-gradient(145deg,#fff,#e8e8f0)',
                      boxShadow: 'var(--clay-shadow-sm)',
                      border: '1.5px solid rgba(255,255,255,0.5)',
                    } : {}}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {item.label}
                  </Link>
                )
              })}
            </nav>

            {/* Header Right: Auth & Actions */}
            <div className="hidden md:flex items-center gap-3 font-sans">
              {user ? (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl" style={{ background: 'linear-gradient(145deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))', boxShadow: 'var(--clay-shadow-sm)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <img
                      src={user.avatarUrl}
                      alt={user.username}
                      className="w-6 h-6 rounded-full object-cover"
                      style={{ boxShadow: 'var(--clay-shadow-sm)', border: '1.5px solid rgba(255,255,255,0.15)' }}
                    />
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-white leading-none">{user.username}</span>
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    title="Sign Out"
                    className="clay-btn-ghost !py-1.5 !px-3 !text-[10px]"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Sign Out
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleGithubLogin}
                  disabled={isLoggingIn}
                  className="clay-btn"
                >
                  <Github className="w-4 h-4" />
                  {isLoggingIn ? 'Connecting…' : 'Connect GitHub'}
                </button>
              )}
            </div>

            {/* Mobile menu button */}
            <button
              className="md:hidden p-2 rounded-lg text-gray-400 hover:bg-white/5 hover:text-white transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-6 h-6 text-white" /> : <Menu className="w-6 h-6 text-white" />}
            </button>
          </div>
        </div>

        {/* Mobile Nav */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/[0.07] px-4 py-4 space-y-3" style={{ background: 'rgba(10,10,18,0.97)', backdropFilter: 'blur(28px)' }}>
            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = location.pathname === item.path
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold uppercase tracking-wide transition-all ${
                      isActive ? 'text-black' : 'text-gray-400 hover:text-white hover:bg-white/[0.06]'
                    }`}
                    style={isActive ? {
                      background: 'linear-gradient(145deg,#fff,#e8e8f0)',
                      boxShadow: 'var(--clay-shadow-sm)',
                      border: '1.5px solid rgba(255,255,255,0.5)',
                    } : {}}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                )
              })}
            </nav>
            <div className="pt-4 border-t border-white/[0.07] space-y-3">
              {user ? (
                <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'linear-gradient(145deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))', boxShadow: 'var(--clay-shadow-sm)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="flex items-center gap-3">
                    <img src={user.avatarUrl} alt={user.username} className="w-8 h-8 rounded-full object-cover" style={{ boxShadow: 'var(--clay-shadow-sm)' }} />
                    <span className="text-xs font-bold text-white">{user.username}</span>
                  </div>
                  <button onClick={handleLogout} className="clay-btn-ghost !py-1 !px-2.5 !text-[10px]">Sign Out</button>
                </div>
              ) : (
                <button
                  onClick={() => { setMobileMenuOpen(false); handleGithubLogin(); }}
                  disabled={isLoggingIn}
                  className="clay-btn w-full justify-center"
                >
                  <Github className="w-4 h-4" /> {isLoggingIn ? 'Connecting…' : 'Connect GitHub'}
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}
