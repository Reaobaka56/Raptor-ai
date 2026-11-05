import {
  LayoutDashboard, List, BarChart3, Users, Calendar, MessageSquare,
  Terminal, KeyRound, Bot, Brain, Newspaper,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface NavItem {
  path: string
  label: string
  icon: LucideIcon
  /** Show the unread-messages count on this item. */
  badge?: boolean
}

// Blog is shown to every authenticated user — the Blog page gates
// create/edit/delete behind its own isAdmin check and the backend enforces it
// independently, so this is read access to a nav item, not a permission change.
export const NAV_ITEMS: NavItem[] = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/reviews',   label: 'Reviews',   icon: List },
  { path: '/agents',    label: 'Agents',    icon: Bot },
  { path: '/sandbox',   label: 'Sandbox',   icon: Terminal },
  { path: '/analytics', label: 'Analytics', icon: BarChart3 },
  { path: '/teams',     label: 'Teams',     icon: Users },
  { path: '/chat',      label: 'Chat',      icon: MessageSquare, badge: true },
  { path: '/calendar',  label: 'Calendar',  icon: Calendar },
  { path: '/blog',      label: 'Blog',      icon: Newspaper },
  { path: '/rules',     label: 'AI Memory', icon: Brain },
  { path: '/settings',  label: 'Settings',  icon: KeyRound },
]

export const SIDEBAR_WIDTH_CLASS = 'w-60'
