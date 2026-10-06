import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import {
  createEstimate,
  useConnectionStore,
  useSessionStore,
  type Item,
} from '../../../entities/session'
import { LiveFacilitatorPanel } from './LiveFacilitatorPanel'

const A11Y = { rules: { 'color-contrast': { enabled: false } } }

function estimate(participantId: string) {
  const result = createEstimate({ participantId, best: 1, likely: 2, worst: 3 })
  if (!result.ok) throw new Error(result.error)
  return result.value
}

function seed(patch: Partial<Item>) {
  const base: Item = {
    id: 'i1',
    title: 'Story',
    description: '',
    notes: '',
    finalResult: null,
    submissions: [estimate('p1')],
    revealed: false,
    round: 0,
  }
  useSessionStore.setState({
    sessionName: '',
    unit: 'days',
    items: [{ ...base, ...patch }],
    activeItemId: 'i1',
  })
  useConnectionStore.setState({ participantNames: { p1: 'Ada' } })
}

function Host({ onAdvance = () => {} }: { onAdvance?: () => void }) {
  const item = useSessionStore((s) => s.items[0]!)
  return (
    <LiveFacilitatorPanel
      item={item}
      unit="days"
      isFirst
      isLast
      onAdvance={onAdvance}
      onNavigatePrev={() => {}}
    />
  )
}

const finalResult = { min: 1, expected: 2, max: 3, ci90: 3 }

beforeEach(() => {
  seed({})
})

describe('LiveFacilitatorPanel', () => {
  it('has no axe violations while waiting, revealed and finalized', async () => {
    const { container } = render(<Host />)
    expect(await axe(container, A11Y)).toHaveNoViolations()

    act(() => seed({ revealed: true }))
    expect(await axe(container, A11Y)).toHaveNoViolations()

    act(() => seed({ revealed: true, finalResult }))
    expect(await axe(container, A11Y)).toHaveNoViolations()
  })

  it('announces the armed reopen prompt in a live region', async () => {
    const user = userEvent.setup()
    seed({ revealed: true, finalResult })
    render(<Host />)

    expect(screen.queryByText('Click Reopen item again to confirm.')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Reopen item' }))

    expect(screen.getByText('Click Reopen item again to confirm.')).toBeInTheDocument()
    expect(
      screen.getByText('Click Reopen item again to confirm.').closest('[role="status"]'),
    ).not.toBeNull()
  })

  it('moves focus to the participants label after a confirmed reopen', async () => {
    const user = userEvent.setup()
    seed({ revealed: true, finalResult })
    render(<Host />)

    await user.click(screen.getByRole('button', { name: 'Reopen item' }))
    await user.click(screen.getByRole('button', { name: 'Click again to reopen' }))

    expect(screen.getByText('Participants')).toHaveFocus()
  })

  it('moves focus to the participants label after Retry round too', async () => {
    const user = userEvent.setup()
    seed({ revealed: true })
    render(<Host />)

    await user.click(screen.getByRole('button', { name: 'Retry round' }))

    expect(screen.getByText('Participants')).toHaveFocus()
  })

  it('does not steal focus on first render or when the item is revealed', async () => {
    const user = userEvent.setup()
    render(<Host />)
    expect(document.body).toHaveFocus()

    await user.click(screen.getByRole('button', { name: /Reveal estimates/ }))

    expect(screen.getByText('Participant estimates')).not.toHaveFocus()
  })

  it('does not move focus when a different item takes the panel over', () => {
    render(<Host />)
    const spy = vi.spyOn(HTMLElement.prototype, 'focus')

    act(() => seed({ id: 'i2', revealed: true }))
    act(() => seed({ id: 'i3', revealed: false }))

    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})
