import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

export type Theme = 'dark' | 'light'

interface ThemeContextValue {
  theme: Theme
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

const THEME_STORAGE_KEY = 'raptor-theme'

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark')

  useEffect(() => {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY) as Theme | null
    if (storedTheme === 'light' || storedTheme === 'dark') {
      setThemeState(storedTheme)
      return
    }
    // Default to dark on first visit
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    setThemeState('dark')
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document.documentElement.classList.toggle('light', theme === 'light')
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
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
