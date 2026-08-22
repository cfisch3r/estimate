import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Header } from './Header'
import { useSessionStore } from '../state/store'

function resetStore() {
  useSessionStore.setState({
    currentScreen: 'create',
    sessionName: '',
    unit: 'days',
    items: [],
    activeItemId: null,
  })
}

beforeEach(resetStore)

describe('Header', () => {
  it('always renders the brand mark', () => {
    render(<Header />)

    expect(screen.getByText('EstiMate')).toBeInTheDocument()
  })

  it('omits the session caption when there is no active session', () => {
    render(<Header />)

    expect(screen.queryByText('Session')).not.toBeInTheDocument()
  })

  it('shows a "Session" caption above the session name once a session is active', () => {
    useSessionStore.setState({ currentScreen: 'session', sessionName: 'Sprint 14' })

    render(<Header />)

    expect(screen.getByText('Session')).toBeInTheDocument()
    expect(screen.getByText('Sprint 14')).toBeInTheDocument()
  })
})
