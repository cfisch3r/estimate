import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { FileDownloadContext } from '../application/composition'
import { Header } from './Header'
import { useSessionStore, useConnectionStore } from '../application/testing'
import { writeSessionFile } from '../domain/sessionFile'
import type { Item } from '../domain/types'

const { disconnectMock, navigateMock } = vi.hoisted(() => ({
  disconnectMock: vi.fn(),
  navigateMock: vi.fn(),
}))

const downloadMock = vi.fn()

vi.mock('../application/useCases/useLiveSession', () => ({
  useLiveSession: () => ({ connect: vi.fn(), disconnect: disconnectMock }),
}))

vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>()
  return { ...actual, useNavigate: () => navigateMock }
})

function resetStore() {
  useSessionStore.setState({
    sessionName: '',
    unit: 'days',
    items: [],
    activeItemId: null,
    lastSavedFile: null,
  })
  useConnectionStore.setState({
    mode: 'manual',
    role: 'facilitator',
    peerCount: 0,
  })
}

function renderHeader(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <FileDownloadContext.Provider value={{ download: downloadMock }}>
        <Header />
      </FileDownloadContext.Provider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  disconnectMock.mockClear()
  navigateMock.mockClear()
  resetStore()
})

describe('Header', () => {
  it('always renders the brand mark', () => {
    renderHeader()

    expect(screen.getByText('EstiMate')).toBeInTheDocument()
  })

  it('always renders a feedback link that opens the GitHub issue template in a new tab', () => {
    renderHeader()

    const link = screen.getByRole('link', { name: 'Send feedback' })
    expect(link).toHaveAttribute(
      'href',
      'https://github.com/cfisch3r/estimate/issues/new?template=feedback.yml',
    )
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('omits the mode tag on the mode-select and join screens', () => {
    renderHeader('/')
    expect(screen.queryByText('Single-user')).not.toBeInTheDocument()
  })

  it('omits the mode tag on the join screen', () => {
    renderHeader('/join')
    expect(screen.queryByText('Single-user')).not.toBeInTheDocument()
  })

  it('shows the Single-user tag in manual mode once in the workspace', () => {
    useConnectionStore.setState({ mode: 'manual' })

    renderHeader('/workspace')

    expect(screen.getByText('Single-user')).toBeInTheDocument()
  })

  it('shows the Live tag in live mode', () => {
    useConnectionStore.setState({ mode: 'live' })

    renderHeader('/workspace')

    expect(screen.getByText('Live')).toBeInTheDocument()
  })

  it('does not make the brand a button on mode-select or join', () => {
    renderHeader('/')
    expect(
      screen.queryByRole('button', { name: /mode selection/ }),
    ).not.toBeInTheDocument()
  })

  it.each(['/workspace', '/summary'])(
    'offers Save session to the facilitator on %s',
    (path) => {
      renderHeader(path)

      expect(screen.getByRole('button', { name: /^Save session/ })).toBeInTheDocument()
    },
  )

  it('offers no Save session on mode selection or to a participant', () => {
    renderHeader('/')
    expect(screen.queryByRole('button', { name: /Save session/ })).not.toBeInTheDocument()

    useConnectionStore.setState({ mode: 'live', role: 'participant' })
    renderHeader('/workspace')
    expect(screen.queryByRole('button', { name: /Save session/ })).not.toBeInTheDocument()
  })

  it('names unsaved changes on the Save button', () => {
    useSessionStore.setState({ sessionName: 'Named' })
    renderHeader('/workspace')

    expect(
      screen.getByRole('button', { name: 'Save session (unsaved changes)' }),
    ).toBeInTheDocument()
  })

  it('does not make the brand a button on join', () => {
    renderHeader('/join')
    expect(
      screen.queryByRole('button', { name: /mode selection/ }),
    ).not.toBeInTheDocument()
  })

  it.each(['/workspace', '/summary'])(
    'makes the brand a clickable exit on %s',
    (path) => {
      renderHeader(path)

      expect(
        screen.getByRole('button', { name: 'Back to mode selection' }),
      ).toBeInTheDocument()
    },
  )

  const storyItem: Item = {
    id: '1',
    title: 'A',
    description: '',
    notes: '',
    finalResult: null,
    submissions: [],
    revealed: false,
    round: 0,
  }

  it('leaves a saved single-user session immediately, resetting items and navigating home', async () => {
    const user = userEvent.setup()
    useConnectionStore.setState({ mode: 'manual' })
    useSessionStore.setState({
      sessionName: 'My session',
      items: [storyItem],
      activeItemId: '1',
      lastSavedFile: writeSessionFile({
        sessionName: 'My session',
        unit: 'days',
        items: [storyItem],
      }),
    })
    renderHeader('/workspace')

    await user.click(screen.getByRole('button', { name: 'Back to mode selection' }))

    expect(useSessionStore.getState()).toMatchObject({
      items: [],
      sessionName: '',
      activeItemId: null,
    })
    expect(useConnectionStore.getState()).toMatchObject({ mode: 'manual', peerCount: 0 })
    expect(navigateMock).toHaveBeenCalledTimes(1)
    expect(navigateMock).toHaveBeenCalledWith('/')
  })

  it('requires a second click to leave a session with unsaved changes', async () => {
    const user = userEvent.setup()
    useSessionStore.setState({ sessionName: 'My session', items: [storyItem] })
    renderHeader('/workspace')

    await user.click(screen.getByRole('button', { name: 'Back to mode selection' }))
    expect(navigateMock).not.toHaveBeenCalled()
    const armed = screen.getByRole('button', {
      name: 'Unsaved changes, click again to leave',
    })
    // Also announced, since a renamed focused button often isn't.
    expect(screen.getByRole('status')).toHaveTextContent(
      'Unsaved changes, click again to leave',
    )

    await user.click(armed)
    expect(navigateMock).toHaveBeenCalledTimes(1)
    expect(navigateMock).toHaveBeenCalledWith('/')
  })

  it('leaves immediately for a live facilitator with nobody connected', async () => {
    const user = userEvent.setup()
    useConnectionStore.setState({ mode: 'live', peerCount: 0 })
    renderHeader('/workspace')

    await user.click(screen.getByRole('button', { name: 'Back to mode selection' }))

    expect(navigateMock).toHaveBeenCalledTimes(1)
    expect(navigateMock).toHaveBeenCalledWith('/')
  })

  it('requires a second click to leave a live session with participants connected', async () => {
    const user = userEvent.setup()
    useConnectionStore.setState({ mode: 'live', peerCount: 2 })
    renderHeader('/workspace')

    await user.click(screen.getByRole('button', { name: 'Back to mode selection' }))
    expect(navigateMock).not.toHaveBeenCalled()
    expect(
      screen.getByRole('button', { name: 'Click again to leave session' }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Click again to leave session' }))
    expect(navigateMock).toHaveBeenCalledTimes(1)
    expect(navigateMock).toHaveBeenCalledWith('/')
    expect(disconnectMock).toHaveBeenCalled()
  })
})
