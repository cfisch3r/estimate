import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SessionSidebar } from './SessionSidebar'
import type { Item } from '../state/types'

function item(id: string, title: string, finalResult: Item['finalResult'] = null): Item {
  return {
    id,
    title,
    description: '',
    notes: '',
    finalResult,
    submissions: [],
    revealed: false,
  }
}

const finalized = { min: 1, expected: 2, max: 3, ci90: 3 }

function renderSidebar(props: Partial<Parameters<typeof SessionSidebar>[0]> = {}) {
  return render(
    <SessionSidebar
      items={[item('1', 'A'), item('2', 'B')]}
      activeItemId="1"
      currentScreen="workspace"
      onSelect={vi.fn()}
      onReorder={vi.fn()}
      onRemove={vi.fn()}
      onAdd={vi.fn()}
      onGoSummary={vi.fn()}
      {...props}
    />,
  )
}

describe('SessionSidebar', () => {
  it('shows the finalized/total count', () => {
    renderSidebar({
      items: [item('1', 'A', finalized), item('2', 'B'), item('3', 'C')],
      activeItemId: '2',
    })

    expect(screen.getByText('1/3 finalized')).toBeInTheDocument()
  })

  it('marks the active item row distinctly from inactive rows', () => {
    renderSidebar({ items: [item('1', 'A'), item('2', 'B')], activeItemId: '1' })

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
    renderSidebar({ onSelect })

    await user.click(screen.getByText('B'))

    expect(onSelect).toHaveBeenCalledWith('2')
  })

  it('renders an extra status icon on finalized rows', () => {
    renderSidebar({
      items: [item('1', 'Done', finalized), item('2', 'Pending')],
      activeItemId: null,
    })

    const iconCount = (title: string) =>
      screen.getByText(title).parentElement!.querySelectorAll('svg').length

    // grip only for pending; grip + finalized check for done
    expect(iconCount('Done')).toBe(iconCount('Pending') + 1)
  })

  it('calls onRemove with the item id without also selecting it', async () => {
    const user = userEvent.setup()
    const onRemove = vi.fn()
    const onSelect = vi.fn()
    renderSidebar({ onRemove, onSelect })

    const bRow = screen.getByText('B').closest('.session-sidebar-row')!
    await user.click(bRow.querySelector('button[aria-label="Remove item"]')!)

    expect(onRemove).toHaveBeenCalledWith('2')
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('calls onAdd with the typed title and clears the input', async () => {
    const user = userEvent.setup()
    const onAdd = vi.fn()
    renderSidebar({ onAdd })

    const input = screen.getByPlaceholderText('Add an item')
    await user.type(input, 'New item')
    await user.click(screen.getByRole('button', { name: 'Add item' }))

    expect(onAdd).toHaveBeenCalledWith('New item')
    expect(input).toHaveValue('')
  })

  it('calls onReorder with the dragged and drop-target indices', () => {
    const onReorder = vi.fn()
    renderSidebar({
      items: [item('1', 'A'), item('2', 'B'), item('3', 'C')],
      onReorder,
    })

    const rows = screen.getAllByText(/^[ABC]$/).map((el) => el.closest('div[draggable]')!)

    fireEvent.dragStart(rows[0]!)
    fireEvent.dragOver(rows[2]!)
    fireEvent.drop(rows[2]!)

    expect(onReorder).toHaveBeenCalledWith(0, 2)
  })

  it('calls onGoSummary when the Summary link is clicked', async () => {
    const user = userEvent.setup()
    const onGoSummary = vi.fn()
    renderSidebar({ items: [item('1', 'A')], onGoSummary })

    await user.click(screen.getByText('Summary'))

    expect(onGoSummary).toHaveBeenCalled()
  })
})
