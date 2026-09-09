import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Header } from './Header'
import { useSessionStore } from '../state/store'

function resetStore() {
  useSessionStore.setState({
    currentScreen: 'mode-select',
    sessionName: '',
    unit: 'days',
    items: [],
    activeItemId: null,
    mode: 'manual',
  })
}

beforeEach(resetStore)

describe('Header', () => {
  it('always renders the brand mark', () => {
    render(<Header />)

    expect(screen.getByText('EstiMate')).toBeInTheDocument()
  })

  it('omits the mode tag on the mode-select and join screens', () => {
    render(<Header />)
    expect(screen.queryByText('Single-user')).not.toBeInTheDocument()

    useSessionStore.setState({ currentScreen: 'join' })
    expect(screen.queryByText('Single-user')).not.toBeInTheDocument()
  })

  it('shows the Single-user tag in manual mode once in the workspace', () => {
    useSessionStore.setState({ currentScreen: 'workspace', mode: 'manual' })

    render(<Header />)

    expect(screen.getByText('Single-user')).toBeInTheDocument()
  })

  it('shows the Live tag in live mode', () => {
    useSessionStore.setState({ currentScreen: 'workspace', mode: 'live' })

    render(<Header />)

    expect(screen.getByText('Live')).toBeInTheDocument()
  })
})
