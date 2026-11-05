import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { Reveal } from './Reveal'

afterEach(() => { vi.unstubAllGlobals() })

describe('Reveal', () => {
  it('shows content immediately when IntersectionObserver is unavailable', () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    render(<Reveal><p>hello</p></Reveal>)
    expect(screen.getByText('hello').parentElement).toHaveClass('is-visible')
  })

  it('stays hidden until scrolled into view, then reveals once', () => {
    let trigger: (e: Partial<IntersectionObserverEntry>[]) => void = () => {}
    const disconnect = vi.fn()
    vi.stubGlobal('IntersectionObserver', class {
      constructor(cb: (e: Partial<IntersectionObserverEntry>[]) => void) { trigger = cb }
      observe() {}
      disconnect = disconnect
    })
    render(<Reveal delay={80}><p>hi</p></Reveal>)
    const wrap = screen.getByText('hi').parentElement!
    expect(wrap).not.toHaveClass('is-visible')
    expect(wrap).toHaveStyle({ transitionDelay: '80ms' })
    act(() => trigger([{ isIntersecting: true }]))
    expect(wrap).toHaveClass('is-visible')
    expect(disconnect).toHaveBeenCalled()
  })
})
