import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../theme'

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`fixed bottom-4 right-4 z-50 inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-semibold transition-all shadow-lg backdrop-blur-xl focus:outline-none focus:ring-2 focus:ring-white/20 sm:bottom-6 sm:right-6 ${isDark ? 'border-white/15 bg-white/10 text-white hover:bg-white/20' : 'border-slate-300/40 bg-slate-900/10 text-slate-900 hover:bg-slate-900/20'}`}
    >
      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      {isDark ? 'Light mode' : 'Dark mode'}
    </button>
  )
}
