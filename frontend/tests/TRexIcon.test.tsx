import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { ThemeProvider } from '../src/theme'
import { TRexIcon } from '../src/components/TRexIcon'

describe('TRexIcon', () => {
  it('renders an svg inside the theme provider', () => {
    const { container } = render(
      <ThemeProvider>
        <TRexIcon data-testid="trex-icon" />
      </ThemeProvider>
    )
    expect(container.querySelector('svg')).toBeInTheDocument()
  })
})
