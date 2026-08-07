import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, List, BarChart3, Menu, X, Github,
  LogOut, BookOpen, Compass, Users, Calendar, MessageSquare, ChevronDown, Terminal, KeyRound, Bot, Kanban, Activity
} from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { TRexIcon } from './TRexIcon'
import { startGithubLogin, chatApi, type UserProfile } from '../api'

interface LayoutProps { children: React.ReactNode }

const navItems = [
  { path: '/dashboard',  label: 'Dashboard',  icon: LayoutDashboard },
  { path: '/reviews',    label: 'Reviews',    icon: List },
  { path: '/analytics',  label: 'Analytics',  icon: BarChart3 },
  { path: '/rules',      label: 'Rules',      icon: BookOpen },
  { path: '/onboarding', label: 'Onboarding', icon: Compass },
  { path: '/teams',      label: 'Teams',      icon: Users },
  { path: '/calendar',   label: 'Calendar',   icon: Calendar },
  { path: '/chat',            label: 'Chat',            icon: MessageSquare, badge: true },
  { path: '/agent-dashboard', label: 'Agent Dash',      icon: Activity },
  { path: '/agents',          label: 'Agents',          icon: Bot },
  { path: '/tasks',           label: 'Tasks',           icon: Kanban },
  { path: '/sandbox',         label: 'Sandbox',         icon: Terminal },
  { path: '/settings',        label: 'Settings',        icon: KeyRound },
]

export default function Layout({ children }: LayoutProps) {
  const location  = useLocation()
  const navigate  = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen]     = useState(false)
  const [user, setUser] = useState<UserProfile | null>(null)
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const userMenuRef = useRef<HTMLDivElement>(null)

  // Close mobile menu on route change
  useEffect(() => { setMobileMenuOpen(false) }, [location.pathname])

  // Close user menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

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

  // Poll unread count every 30s
  useEffect(() => {
    if (!localStorage.getItem('token')) return
    const fetch = () => chatApi.getUnreadCount().then(r => setUnreadCount(r.data.count)).catch(() => {})
    fetch()
    const iv = setInterval(fetch, 30000)
    return () => clearInterval(iv)
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

  const NavLink = ({ path, label, icon: Icon, badge }: typeof navItems[0]) => {
    const active = location.pathname === path || location.pathname.startsWith(path + '/')
    const showBadge = badge && unreadCount > 0
    return (
      <Link to={path}
        className={`relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
          active
            ? 'bg-white text-black'
            : 'text-gray-400 hover:bg-white/5 hover:text-white'
        }`}>
        <Icon className="h-4 w-4 flex-none" />
        <span>{label}</span>
        {showBadge && (
          <span className={`ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[10px] font-black ${active ? 'bg-black text-white' : 'bg-white text-black'}`}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Link>
    )
  }

  return (
    <div className="min-h-screen bg-black text-gray-300 font-sans flex flex-col">

      {/* ── Top nav ── */}
      <header className="sticky top-0 z-50 border-b border-white/8 bg-black/95 backdrop-blur-xl">
        <div className="flex h-14 items-center gap-3 px-4">

          {/* Mobile hamburger */}
          <button
            className="flex-none rounded-lg border border-white/10 p-1.5 text-gray-400 hover:text-white transition md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Menu">
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          {/* Logo */}
          <Link to="/dashboard" className="flex items-center gap-2 text-white flex-none">
            <TRexIcon className="h-6 w-6" />
            <span className="text-sm font-bold tracking-tight hidden sm:block">Raptor AI</span>
          </Link>

          {/* Desktop nav pills */}
          <nav className="hidden md:flex items-center gap-1 flex-1 overflow-x-auto scrollbar-none">
            {navItems.map(item => {
              const active = location.pathname === item.path
              const showBadge = item.badge && unreadCount > 0
              return (
                <Link key={item.path} to={item.path}
                  className={`relative flex items-center gap-1.5 rounded border px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-all ${
                    active
                      ? 'border-white bg-white text-black'
                      : 'border-transparent text-gray-400 hover:border-white/15 hover:text-white'
                  }`}>
                  <item.icon className="h-3.5 w-3.5 flex-none" />
                  {item.label}
                  {showBadge && (
                    <span className={`flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-black ${active ? 'bg-black text-white' : 'bg-white text-black'}`}>
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Link>
              )
            })}
          </nav>

          <div className="flex-1 md:flex-none" />

          {/* User menu */}
          {user ? (
            <div className="relative flex-none" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 rounded-lg border border-white/10 pl-1 pr-2 py-1 hover:border-white/25 transition">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.username}
                    className="h-7 w-7 rounded-full border border-white/10 object-cover" />
                ) : (
                  <div className="h-7 w-7 rounded-full border border-white/10 bg-white/5 flex items-center justify-center text-xs font-bold text-white">
                    {user.username?.[0]?.toUpperCase()}
                  </div>
                )}
                <span className="text-xs font-semibold text-white hidden sm:block max-w-[100px] truncate">{user.username}</span>
                <ChevronDown className="h-3 w-3 text-gray-500 hidden sm:block" />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-52 rounded-xl border border-white/10 bg-[#0d0d14] shadow-2xl overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-white/8">
                    <div className="flex items-center gap-2.5">
                      {user.avatarUrl ? (
                        <img src={user.avatarUrl} alt={user.username} className="h-8 w-8 rounded-full border border-white/10" />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-sm font-bold text-white">
                          {user.username?.[0]?.toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-white truncate">@{user.username}</p>
                        {user.email && <p className="text-xs text-gray-600 truncate">{user.email}</p>}
                      </div>
                    </div>
                    {user.role === 'admin' && (
                      <span className="mt-2 inline-block rounded bg-amber-500/15 border border-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-400">
                        ⭐ Premium
                      </span>
                    )}
                  </div>
                  <div className="p-1">
                    <Link to="/dashboard" onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-400 hover:bg-white/5 hover:text-white transition">
                      <LayoutDashboard className="h-4 w-4" /> Dashboard
                    </Link>
                    <button onClick={() => { setUserMenuOpen(false); handleLogout(); }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition">
                      <LogOut className="h-4 w-4" /> Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button onClick={handleGithubLogin} disabled={isLoggingIn}
              className="flex-none flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-black hover:bg-gray-100 transition disabled:opacity-60">
              <Github className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{isLoggingIn ? 'Connecting…' : 'Login'}</span>
            </button>
          )}
        </div>
      </header>

      {/* ── Mobile drawer ── */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <aside className="absolute left-0 top-14 bottom-0 w-72 bg-[#0a0a10] border-r border-white/10 overflow-y-auto">
            <div className="p-3 space-y-1">
              {navItems.map(item => (
                <NavLink key={item.path} {...item} />
              ))}
            </div>
            {user && (
              <div className="border-t border-white/8 p-4 mt-2">
                <div className="flex items-center gap-3 mb-3">
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user.username} className="h-9 w-9 rounded-full border border-white/10" />
                  ) : (
                    <div className="h-9 w-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-sm font-bold text-white">
                      {user.username?.[0]?.toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-bold text-white">@{user.username}</p>
                    {user.role === 'admin' && <span className="text-[10px] text-amber-400 font-bold">⭐ Premium</span>}
                  </div>
                </div>
                <button onClick={handleLogout}
                  className="flex w-full items-center gap-2 rounded-lg border border-red-500/20 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition">
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              </div>
            )}
          </aside>
        </div>
      )}

      {/* ── Page content ── */}
      <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto w-full">
        {children}
      </main>

      {/* ── Footer ── */}
      <footer className="border-t-0 bg-black px-4 sm:px-6 py-6 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <TRexIcon className="h-4 w-4 text-white" />
            <span className="text-xs font-bold text-white">Raptor AI</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-600">
            <Link to="/docs" className="hover:text-white transition">Docs</Link>
            <Link to="/blog" className="hover:text-white transition">Blog</Link>
            <Link to="/privacy" className="hover:text-white transition">Privacy</Link>
            <Link to="/terms" className="hover:text-white transition">Terms</Link>
          </div>
          <p className="text-xs text-gray-700">© 2026 Raptor AI · Cape Town, SA</p>
        </div>
      </footer>
    </div>
  )
}

