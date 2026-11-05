import { Link } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { TRexIcon } from '../../../TRexIcon'
import { ThemeToggle } from '../../../ThemeToggle'

interface MobileTopBarProps {
  menuOpen: boolean
  onOpenMenu: () => void
}

/** Slim header shown below md only — on desktop the sidebar replaces the top nav. */
export function MobileTopBar({ menuOpen, onOpenMenu }: MobileTopBarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-white/10 bg-black/95 px-4 backdrop-blur-xl md:hidden">
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="Open menu"
        aria-expanded={menuOpen}
        aria-controls="app-sidebar"
        className="flex-none rounded-lg border border-white/10 p-1.5 text-gray-400 transition hover:text-white"
      >
        <Menu className="h-5 w-5" />
      </button>
      <Link to="/dashboard" className="flex items-center gap-2 text-white">
        <TRexIcon className="h-6 w-6" />
        <span className="text-sm font-bold tracking-tight">Raptor AI</span>
      </Link>
      <div className="flex-1" />
      <ThemeToggle compact />
    </header>
  )
}
