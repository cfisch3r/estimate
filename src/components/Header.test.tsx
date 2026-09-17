import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Header } from './Header'
import { useSessionStore } from '../state/store'

const { disconnectMock } = vi.hoisted(() => ({ disconnectMock: vi.fn() }))

vi.mock('../network', () => ({
  useNetworkSession: () => ({ connect: vi.fn(), disconnect: disconnectMock }),
}))

function resetStore() {
  useSessionStore.setState({
    currentScreen: 'mode-select',
    sessionName: '',
    unit: 'days',
    items: [],
    activeItemId: null,
    mode: 'manual',
    role: 'facilitator',
    peerCount: 0,
  })
}

beforeEach(() => {
  disconnectMock.mockClear()
  resetStore()
})

describe('Header', () => {
  it('always renders the brand mark', () => {
    render(<Header />)

    expect(screen.getByText('EstiMate')).toBeInTheDocument()
  })

  it('always renders a feedback link that opens the GitHub issue template in a new tab', () => {
    render(<Header />)

    const link = screen.getByRole('link', { name: 'Send feedback' })
    expect(link).toHaveAttribute(
      'href',
      'https://github.com/cfisch3r/estimate/issues/new?template=feedback.yml',
    )
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
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

  it('does not make the brand a button on mode-select or join', () => {
    render(<Header />)
    expect(
      screen.queryByRole('button', { name: /mode selection/ }),
    ).not.toBeInTheDocument()

    useSessionStore.setState({ currentScreen: 'join' })
    expect(
      screen.queryByRole('button', { name: /mode selection/ }),
    ).not.toBeInTheDocument()
  })

  it.each(['workspace', 'summary', 'history'] as const)(
    'makes the brand a clickable exit on %s',
    (currentScreen) => {
      useSessionStore.setState({ currentScreen })
      render(<Header />)

      expect(
        screen.getByRole('button', { name: 'Back to mode selection' }),
      ).toBeInTheDocument()
    },
  )

  it('leaves immediately in single-user mode, resetting items and the screen', async () => {
    const user = userEvent.setup()
    useSessionStore.setState({
      currentScreen: 'workspace',
      mode: 'manual',
      sessionName: 'My session',
      items: [
        {
          id: '1',
          title: 'A',
          description: '',
          notes: '',
          finalResult: null,
          submissions: [],
          revealed: false,
          round: 0,
        },
      ],
      activeItemId: '1',
    })
    render(<Header />)

    await user.click(screen.getByRole('button', { name: 'Back to mode selection' }))

    expect(useSessionStore.getState()).toMatchObject({
      currentScreen: 'mode-select',
      items: [],
      sessionName: '',
      activeItemId: null,
    })
  })

  it('leaves immediately for a live facilitator with nobody connected', async () => {
    const user = userEvent.setup()
    useSessionStore.setState({ currentScreen: 'workspace', mode: 'live', peerCount: 0 })
    render(<Header />)

    await user.click(screen.getByRole('button', { name: 'Back to mode selection' }))

    expect(useSessionStore.getState().currentScreen).toBe('mode-select')
  })

  it('requires a second click to leave a live session with participants connected', async () => {
    const user = userEvent.setup()
    useSessionStore.setState({ currentScreen: 'workspace', mode: 'live', peerCount: 2 })
    render(<Header />)

    await user.click(screen.getByRole('button', { name: 'Back to mode selection' }))
    expect(useSessionStore.getState().currentScreen).toBe('workspace')
    expect(
      screen.getByRole('button', { name: 'Click again to leave session' }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Click again to leave session' }))
    expect(useSessionStore.getState().currentScreen).toBe('mode-select')
    expect(disconnectMock).toHaveBeenCalled()
  })
})
