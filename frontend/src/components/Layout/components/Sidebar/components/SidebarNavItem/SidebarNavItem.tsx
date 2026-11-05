import { Link } from 'react-router-dom'
import type { NavItem } from '../../constants'

interface SidebarNavItemProps {
  item: NavItem
  active: boolean
  unreadCount?: number
}

export function SidebarNavItem({ item, active, unreadCount = 0 }: SidebarNavItemProps) {
  const { path, label, icon: Icon, badge } = item
  const showBadge = badge && unreadCount > 0

  return (
    <Link
      to={path}
      aria-current={active ? 'page' : undefined}
      className={`relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30 ${
        active ? 'bg-white text-black' : 'text-gray-400 hover:bg-white/5 hover:text-white'
      }`}
    >
      <Icon className="h-4 w-4 flex-none" />
      <span className="truncate">{label}</span>
      {showBadge && (
        <span
          aria-label={`${unreadCount} unread`}
          className={`ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[10px] font-black ${
            active ? 'bg-black text-white' : 'bg-white text-black'
          }`}
        >
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </Link>
  )
}
