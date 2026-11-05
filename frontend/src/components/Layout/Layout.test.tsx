import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '../../theme'
import { AuthProvider } from '../../context/AuthContext'
import Layout from './Layout'
import { NAV_ITEMS } from './components/Sidebar/constants'

vi.mock('../../api', () => ({
  chatApi: { getUnreadCount: vi.fn().mockResolvedValue({ data: { count: 3 } }) },
}))

function renderLayout(path = '/reviews') {
  localStorage.setItem('token', 't')
  localStorage.setItem('user', JSON.stringify({ username: 'scott', role: 'admin' }))
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ThemeProvider>
        <AuthProvider>
          <Layout><p>page body</p></Layout>
        </AuthProvider>
      </ThemeProvider>
    </MemoryRouter>
  )
}

describe('Layout with sidebar', () => {
  beforeEach(() => { localStorage.clear(); document.documentElement.className = '' })

  it('renders every nav item in a labelled sidebar nav and the page body', () => {
    renderLayout()
    const nav = screen.getByRole('navigation', { name: 'Main' })
    for (const item of NAV_ITEMS) {
      expect(nav).toHaveTextContent(item.label)
    }
    expect(screen.getByText('page body')).toBeInTheDocument()
  })

  it('marks the current route with aria-current', () => {
    renderLayout('/reviews/abc')
    expect(screen.getByRole('link', { name: 'Reviews' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Agents' })).not.toHaveAttribute('aria-current')
  })

  it('shows the unread badge on Chat', async () => {
    renderLayout()
    expect(await screen.findByLabelText('3 unread')).toBeInTheDocument()
  })

  it('toggles the app shell between dark and light via data-theme', () => {
    const { container } = renderLayout()
    const shell = container.querySelector('[data-theme]')!
    expect(shell).toHaveAttribute('data-theme', 'dark')
    fireEvent.click(screen.getAllByRole('button', { name: 'Switch to light mode' })[0])
    expect(shell).toHaveAttribute('data-theme', 'light')
  })

  it('opens and closes the mobile drawer (Escape closes)', () => {
    renderLayout()
    const aside = document.getElementById('app-sidebar')!
    expect(aside.className).toContain('-translate-x-full')
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))
    expect(aside.className).not.toContain('-translate-x-full')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(aside.className).toContain('-translate-x-full')
  })

  it('signs out from the sidebar', () => {
    renderLayout()
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(localStorage.getItem('token')).toBeNull()
  })
})
