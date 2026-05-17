import { Link, useLocation, useNavigate } from 'react-router-dom'
import { 
  LayoutDashboard, 
  List, 
  BarChart3, 
  Menu,
  X,
  Github,
  LogOut
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { TRexIcon } from './TRexIcon'
import { authApi, type UserProfile } from '../api'

interface LayoutProps {
  children: React.ReactNode
}

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/reviews', label: 'Reviews', icon: List },
  { path: '/analytics', label: 'Analytics', icon: BarChart3 },
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

  const handleLogin = async () => {
    setIsLoggingIn(true)
    try {
      const res = await authApi.loginWithGithub()
      localStorage.setItem('token', res.data.token)
      localStorage.setItem('user', JSON.stringify(res.data.user))
      setUser(res.data.user)
      window.dispatchEvent(new Event('auth-change'))
    } catch (err) {
      console.error('GitHub authentication failed', err)
    } finally {
      setIsLoggingIn(false)
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
    <div className="min-h-screen bg-black text-gray-300 font-sans selection:bg-white/20 selection:text-white">
      {/* Header */}
      <header className="bg-black/80 backdrop-blur-xl border-b border-white/10 sticky top-0 z-50">
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
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
                      isActive
                        ? 'bg-white text-black font-bold'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {item.label}
                  </Link>
                )
              })}
            </nav>

            {/* Header Right: Auth & Actions */}
            <div className="hidden md:flex items-center gap-4 font-sans">
              {user ? (
                <div className="flex items-center gap-4 pl-4 border-l border-white/10">
                  <div className="flex items-center gap-2.5 bg-white/5 border border-white/10 px-3 py-1 rounded-full">
                    <img 
                      src={user.avatarUrl} 
                      alt={user.username} 
                      className="w-6 h-6 rounded-full border border-white/20 object-cover"
                    />
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-white leading-none">{user.username}</span>
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    title="Sign Out"
                    className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors border border-white/10 bg-white/5 text-xs inline-flex items-center gap-1 font-semibold"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Sign Out
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleLogin}
                  disabled={isLoggingIn}
                  className="inline-flex items-center gap-2 bg-white text-black px-4 py-2 rounded text-xs font-semibold hover:bg-gray-100 transition-colors disabled:opacity-50"
                >
                  <Github className={`w-4 h-4 ${isLoggingIn ? 'animate-spin' : ''}`} />
                  {isLoggingIn ? 'Connecting...' : 'Connect GitHub'}
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
          <div className="md:hidden border-t border-white/10 bg-black px-4 py-4 space-y-3">
            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = location.pathname === item.path
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold ${
                      isActive
                        ? 'bg-white text-black font-bold'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                )
              })}
            </nav>
            <div className="pt-4 border-t border-white/10 flex items-center justify-between">
              {user ? (
                <div className="w-full flex items-center justify-between bg-white/5 border border-white/10 p-3 rounded-xl">
                  <div className="flex items-center gap-3">
                    <img src={user.avatarUrl} alt={user.username} className="w-8 h-8 rounded-full border border-white/20 object-cover" />
                    <span className="text-xs font-bold text-white">{user.username}</span>
                  </div>
                  <button onClick={handleLogout} className="px-3 py-1 bg-white/10 text-gray-300 hover:text-white text-xs rounded border border-white/10">
                    Sign Out
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { handleLogin(); setMobileMenuOpen(false); }}
                  className="w-full flex items-center justify-center gap-2 bg-white text-black py-2.5 rounded text-xs font-semibold"
                >
                  <Github className="w-4 h-4" /> Connect GitHub
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
