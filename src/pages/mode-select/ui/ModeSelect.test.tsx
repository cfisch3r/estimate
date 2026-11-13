import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { MemoryRouter } from 'react-router'
import { ModeSelect } from './ModeSelect'
import { useSessionStore, useConnectionStore } from '../../../application/testing'

const { connectMock, navigateMock } = vi.hoisted(() => ({
  connectMock: vi.fn(),
  navigateMock: vi.fn(),
}))

vi.mock('../../../application/useCases/sessionCode', () => ({
  generateSessionCode: () => 'LIVECODE',
}))
vi.mock('../../../application/useCases/useLiveSession', () => ({
  useLiveSession: () => ({ connect: connectMock, disconnect: vi.fn() }),
}))
vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>()
  return { ...actual, useNavigate: () => navigateMock }
})

function renderModeSelect() {
  return render(
    <MemoryRouter>
      <ModeSelect />
    </MemoryRouter>,
  )
}

function resetStore() {
  useSessionStore.setState({
    sessionName: '',
    unit: 'days',
    items: [],
    activeItemId: null,
    lastSavedFile: null,
    loadedFrom: null,
  })
  useConnectionStore.setState({
    mode: 'manual',
    role: 'facilitator',
    sessionId: null,
    connectionStatus: 'idle',
    peerCount: 0,
  })
}

beforeEach(() => {
  resetStore()
  connectMock.mockClear()
  navigateMock.mockClear()
})

describe('ModeSelect', () => {
  it('has no axe violations', async () => {
    const { container } = renderModeSelect()

    // color-contrast needs real layout/computed font metrics jsdom doesn't
    // provide; real-browser contrast coverage lives in the e2e axe pass.
    expect(
      await axe(container, { rules: { 'color-contrast': { enabled: false } } }),
    ).toHaveNoViolations()
  })

  it('offers the four entry paths', () => {
    renderModeSelect()

    expect(
      screen.getByRole('button', { name: /Start single-user mode/ }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Start collaborative estimation/ }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Join a collaborative session/ }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Load a saved session/ }),
    ).toBeInTheDocument()
  })

  it('enters the single-user workspace', async () => {
    const user = userEvent.setup()
    renderModeSelect()

    await user.click(screen.getByRole('button', { name: /Start single-user mode/ }))

    expect(useConnectionStore.getState().mode).toBe('manual')
    expect(navigateMock).toHaveBeenCalledTimes(1)
    expect(navigateMock).toHaveBeenCalledWith('/workspace')
  })

  it('generates a code, enters live mode, and connects', async () => {
    const user = userEvent.setup()
    renderModeSelect()

    await user.click(
      screen.getByRole('button', { name: /Start collaborative estimation/ }),
    )

    const state = useConnectionStore.getState()
    expect(state.mode).toBe('live')
    expect(state.sessionId).toBe('LIVECODE')
    expect(connectMock).toHaveBeenCalledWith('LIVECODE')
    expect(navigateMock).toHaveBeenCalledTimes(1)
    expect(navigateMock).toHaveBeenCalledWith('/workspace')
  })

  it('routes to the join screen', async () => {
    const user = userEvent.setup()
    renderModeSelect()

    await user.click(screen.getByRole('button', { name: /Join a collaborative session/ }))

    expect(navigateMock).toHaveBeenCalledTimes(1)
    expect(navigateMock).toHaveBeenCalledWith('/join')
  })

  it('activates a row with the keyboard', async () => {
    const user = userEvent.setup()
    renderModeSelect()

    screen.getByRole('button', { name: /Start single-user mode/ }).focus()
    await user.keyboard('{Enter}')

    expect(navigateMock).toHaveBeenCalledTimes(1)
    expect(navigateMock).toHaveBeenCalledWith('/workspace')
  })

  describe('loading a saved session', () => {
    const SAVED = JSON.stringify({
      version: 1,
      sessionName: 'Checkout rework',
      unit: 'days',
      items: [
        {
          id: 'a',
          title: 'Payment provider switch',
          description: '',
          notes: '',
          finalResult: { min: 3, expected: 5, max: 12, ci90: 9 },
        },
        {
          id: 'b',
          title: 'Address autocomplete',
          description: '',
          notes: '',
          finalResult: null,
        },
      ],
    })

    async function loadFile(text: string, name = 'checkout-rework.estimate.json') {
      const user = userEvent.setup()
      const view = renderModeSelect()
      const input = view.container.querySelector<HTMLInputElement>('input[type="file"]')
      if (!input) throw new Error('No file input')
      await user.upload(input, new File([text], name, { type: 'application/json' }))
      return { user, view }
    }

    it('opens the file picker from the Load row', async () => {
      const user = userEvent.setup()
      const view = renderModeSelect()
      const input = view.container.querySelector<HTMLInputElement>('input[type="file"]')
      const click = vi.spyOn(input as HTMLInputElement, 'click')

      await user.click(screen.getByRole('button', { name: /Load a saved session/ }))

      expect(click).toHaveBeenCalledTimes(1)
    })

    it('previews a loaded session and offers to continue it', async () => {
      const { view } = await loadFile(SAVED)

      const preview = await screen.findByRole('region', { name: 'Loaded session' })
      // The Load row that had focus is gone; focus moves to the loaded session.
      expect(screen.getByRole('heading', { name: 'Checkout rework' })).toHaveFocus()
      expect(preview).toHaveTextContent('Checkout rework')
      expect(preview).toHaveTextContent('2 items')
      expect(preview).toHaveTextContent('1 finalized')
      expect(preview).toHaveTextContent('Unit: days')
      expect(preview).toHaveTextContent('From checkout-rework.estimate.json')
      expect(
        screen.getByText('Continue Checkout rework on your own.'),
      ).toBeInTheDocument()
      expect(
        screen.getByText('Continue Checkout rework live with your team.'),
      ).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: /Join a collaborative session/ }),
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: /Load a saved session/ }),
      ).not.toBeInTheDocument()
      expect(
        await axe(view.container, { rules: { 'color-contrast': { enabled: false } } }),
      ).toHaveNoViolations()
    })

    it('discards a loaded session', async () => {
      const { user } = await loadFile(SAVED)

      await user.click(
        await screen.findByRole('button', { name: 'Discard loaded session' }),
      )

      expect(
        screen.queryByRole('region', { name: 'Loaded session' }),
      ).not.toBeInTheDocument()
      expect(useSessionStore.getState()).toMatchObject({ sessionName: '', items: [] })
      // Focus returns to where the user started.
      expect(screen.getByRole('button', { name: /Load a saved session/ })).toHaveFocus()
    })

    it('shows a session that is still loaded when the screen is visited again', () => {
      useSessionStore.setState({
        sessionName: 'Checkout rework',
        loadedFrom: 'checkout-rework.estimate.json',
      })
      renderModeSelect()

      expect(screen.getByRole('region', { name: 'Loaded session' })).toBeInTheDocument()
      // A plain visit doesn't move focus.
      expect(screen.getByRole('heading', { name: 'Checkout rework' })).not.toHaveFocus()
    })

    it('announces a second identical rejection again', async () => {
      const damaged = SAVED.replace('"min":3', '"min":13')
      const { user, view } = await loadFile(damaged, 'damaged.estimate.json')
      const alert = screen.getByRole('alert')
      await within(alert).findByText(/can’t be loaded/)
      const input = view.container.querySelector<HTMLInputElement>('input[type="file"]')!
      const seen: string[] = []
      const observer = new MutationObserver(() => seen.push(alert.textContent ?? ''))
      observer.observe(alert, { childList: true, subtree: true, characterData: true })

      await user.upload(input, new File([damaged], 'damaged.estimate.json'))
      await within(alert).findByText(/can’t be loaded/)
      observer.disconnect()

      // Emptied, then filled again: a change screen readers announce.
      expect(seen).toContain('')
    })

    it('rejects a damaged file with its reason and loads nothing', async () => {
      const damaged = SAVED.replace('"min":3', '"min":13')
      const { view } = await loadFile(damaged, 'damaged.estimate.json')

      const alert = screen.getByRole('alert')
      expect(await within(alert).findByText(/can’t be loaded/)).toBeInTheDocument()
      expect(alert).toHaveTextContent(
        'Item 1, "Payment provider switch", has a range where the minimum is above the maximum.',
      )
      expect(alert).toHaveTextContent('damaged.estimate.json · nothing was changed')
      expect(useSessionStore.getState().items).toEqual([])
      expect(
        screen.queryByRole('region', { name: 'Loaded session' }),
      ).not.toBeInTheDocument()
      expect(
        await axe(view.container, { rules: { 'color-contrast': { enabled: false } } }),
      ).toHaveNoViolations()
    })
  })
})
