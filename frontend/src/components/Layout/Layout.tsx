import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { TRexIcon } from '../TRexIcon'
import { chatApi } from '../../api'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../theme'
import { Sidebar } from './components/Sidebar'
import { MobileTopBar } from './components/MobileTopBar'

interface LayoutProps { children: React.ReactNode }

export default function Layout({ children }: LayoutProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { isAuthenticated, logout } = useAuth()
  const { theme } = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  // Close the mobile drawer on route change
  useEffect(() => { setMenuOpen(false) }, [location.pathname])

  // Escape closes the mobile drawer
  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [menuOpen])

  // Poll unread count every 30s
  useEffect(() => {
    if (!isAuthenticated) return
    const fetch = () => chatApi.getUnreadCount().then(r => setUnreadCount(r.data.count)).catch(() => {})
    fetch()
    const iv = setInterval(fetch, 30000)
    return () => clearInterval(iv)
  }, [isAuthenticated])

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    // data-theme scopes the light theme tokens (src/index.css) to the app shell.
    <div data-theme={theme} className="min-h-screen bg-black text-gray-300 font-sans">
      <Sidebar
        unreadCount={unreadCount}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onLogout={handleLogout}
      />

      {/* Content column — offset by the sidebar width on md+ */}
      <div className="flex min-h-screen flex-col md:pl-60">
        <MobileTopBar menuOpen={menuOpen} onOpenMenu={() => setMenuOpen(true)} />

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>

        <footer className="mt-auto bg-black px-4 py-6 sm:px-6">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 sm:flex-row">
            <div className="flex items-center gap-2">
              <TRexIcon className="h-4 w-4 text-white" />
              <span className="text-xs font-bold text-white">Raptor AI</span>
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-600">
              <Link to="/docs" className="transition hover:text-white">Docs</Link>
              <Link to="/privacy" className="transition hover:text-white">Privacy</Link>
              <Link to="/terms" className="transition hover:text-white">Terms</Link>
            </div>
            <p className="text-xs text-gray-700">© 2026 Raptor AI · Cape Town, SA</p>
          </div>
        </footer>
      </div>
    </div>
  )
}
