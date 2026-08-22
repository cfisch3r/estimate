import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SessionSidebar } from './SessionSidebar'
import type { Item } from '../state/types'

function item(id: string, title: string, finalResult: Item['finalResult'] = null): Item {
  return { id, title, description: '', notes: '', finalResult }
}

const finalized = { min: 1, expected: 2, max: 3, ci90: 3 }

describe('SessionSidebar', () => {
  it('shows the finalized/total count', () => {
    render(
      <SessionSidebar
        items={[item('1', 'A', finalized), item('2', 'B'), item('3', 'C')]}
        activeItemId="2"
        currentScreen="session"
        onSelect={vi.fn()}
        onReorder={vi.fn()}
        onGoSummary={vi.fn()}
      />,
    )

    expect(screen.getByText('1/3 finalized')).toBeInTheDocument()
  })

  it('marks the active item row distinctly from inactive rows', () => {
    render(
      <SessionSidebar
        items={[item('1', 'A'), item('2', 'B')]}
        activeItemId="1"
        currentScreen="session"
        onSelect={vi.fn()}
        onReorder={vi.fn()}
        onGoSummary={vi.fn()}
      />,
    )

    expect(screen.getByText('A').closest('[data-active]')).toHaveAttribute(
      'data-active',
      'true',
    )
    expect(screen.getByText('B').closest('[data-active]')).toHaveAttribute(
      'data-active',
      'false',
    )
  })

  it('calls onSelect with the clicked item id', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(
      <SessionSidebar
        items={[item('1', 'A'), item('2', 'B')]}
        activeItemId="1"
        currentScreen="session"
        onSelect={onSelect}
        onReorder={vi.fn()}
        onGoSummary={vi.fn()}
      />,
    )

    await user.click(screen.getByText('B'))

    expect(onSelect).toHaveBeenCalledWith('2')
  })

  it('calls onReorder with the dragged and drop-target indices', () => {
    const onReorder = vi.fn()
    render(
      <SessionSidebar
        items={[item('1', 'A'), item('2', 'B'), item('3', 'C')]}
        activeItemId="1"
        currentScreen="session"
        onSelect={vi.fn()}
        onReorder={onReorder}
        onGoSummary={vi.fn()}
      />,
    )

    const rows = screen.getAllByText(/^[ABC]$/).map((el) => el.closest('div[draggable]')!)

    fireEvent.dragStart(rows[0]!)
    fireEvent.dragOver(rows[2]!)
    fireEvent.drop(rows[2]!)

    expect(onReorder).toHaveBeenCalledWith(0, 2)
  })

  it('calls onGoSummary when the Summary link is clicked', async () => {
    const user = userEvent.setup()
    const onGoSummary = vi.fn()
    render(
      <SessionSidebar
        items={[item('1', 'A')]}
        activeItemId="1"
        currentScreen="session"
        onSelect={vi.fn()}
        onReorder={vi.fn()}
        onGoSummary={onGoSummary}
      />,
    )

    await user.click(screen.getByText('Summary'))

    expect(onGoSummary).toHaveBeenCalled()
  })
})
