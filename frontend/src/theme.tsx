import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

export type Theme = 'dark' | 'light'

interface ThemeContextValue {
  theme: Theme
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

export const THEME_STORAGE_KEY = 'raptor-theme'

// Storage can throw (private mode, blocked site data) — theme must still work.
function readStoredTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    /* fall through to default */
  }
  return 'dark' // dark is the default on first visit
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Lazy init so a returning light-mode user never renders a dark frame first.
  const [theme, setThemeState] = useState<Theme>(readStoredTheme)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document.documentElement.classList.toggle('light', theme === 'light')
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch {
      /* non-fatal */
    }
  }, [theme])

  const toggleTheme = () => setThemeState((current) => (current === 'dark' ? 'light' : 'dark'))

  const value = useMemo<ThemeContextValue>(() => ({ theme, toggleTheme, setTheme: setThemeState }), [theme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}
