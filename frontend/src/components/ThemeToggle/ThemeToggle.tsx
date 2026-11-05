import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../../theme'

interface ThemeToggleProps {
  /** Hide the text label (icon-only button). */
  compact?: boolean
  className?: string
}

export function ThemeToggle({ compact = false, className = '' }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'
  const label = isDark ? 'Switch to light mode' : 'Switch to dark mode'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className={`inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm font-medium text-gray-400 transition hover:border-white/20 hover:bg-white/5 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30 ${className}`}
    >
      {isDark ? <Sun className="h-4 w-4 flex-none" /> : <Moon className="h-4 w-4 flex-none" />}
      {!compact && <span>{isDark ? 'Light mode' : 'Dark mode'}</span>}
    </button>
  )
}
