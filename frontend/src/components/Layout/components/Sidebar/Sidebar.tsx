import { Link, useLocation } from 'react-router-dom'
import { LogOut, X } from 'lucide-react'
import { TRexIcon } from '../../../TRexIcon'
import { ThemeToggle } from '../../../ThemeToggle'
import { useAuth } from '../../../../context/AuthContext'
import { NAV_ITEMS, SIDEBAR_WIDTH_CLASS } from './constants'
import { SidebarNavItem } from './components/SidebarNavItem'

interface SidebarProps {
  unreadCount: number
  /** Mobile drawer state. Ignored on md+ where the sidebar is always visible. */
  open: boolean
  onClose: () => void
  onLogout: () => void
}

export function Sidebar({ unreadCount, open, onClose, onLogout }: SidebarProps) {
  const { pathname } = useLocation()
  const { user } = useAuth()

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
        />
      )}

      <aside
        id="app-sidebar"
        className={`fixed inset-y-0 left-0 z-50 flex ${SIDEBAR_WIDTH_CLASS} flex-col border-r border-white/10 bg-black transition-transform duration-200 md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full max-md:invisible'
        }`}
      >
        {/* Brand */}
        <div className="flex h-14 flex-none items-center justify-between px-4">
          <Link to="/dashboard" className="flex items-center gap-2 text-white">
            <TRexIcon className="h-6 w-6" />
            <span className="text-sm font-bold tracking-tight">Raptor AI</span>
          </Link>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="rounded-lg p-1.5 text-gray-400 transition hover:text-white md:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav aria-label="Main" className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.path || pathname.startsWith(item.path + '/')
            return <SidebarNavItem key={item.path} item={item} active={active} unreadCount={unreadCount} />
          })}
        </nav>

        {/* Footer: theme + account */}
        <div className="flex-none space-y-3 border-t border-white/10 p-3">
          <ThemeToggle className="w-full" />
          {user && (
            <div className="flex items-center gap-2.5 rounded-lg px-1">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt="" className="h-8 w-8 flex-none rounded-full border border-white/10 object-cover" />
              ) : (
                <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full border border-white/10 bg-white/5 text-xs font-bold text-white">
                  {user.username?.[0]?.toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">@{user.username}</p>
                {user.role === 'admin' && <p className="text-[10px] font-bold text-amber-400">⭐ Premium</p>}
              </div>
              <button
                type="button"
                onClick={onLogout}
                aria-label="Sign out"
                title="Sign out"
                className="flex-none rounded-lg p-2 text-gray-500 transition hover:bg-red-500/10 hover:text-red-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
