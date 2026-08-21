import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ItemList } from './ItemList'
import type { Item } from '../state/types'

function item(id: string, title: string): Item {
  return { id, title, description: '', notes: '', finalResult: null }
}

describe('ItemList', () => {
  it('swaps a row for an inline edit form and saves the new title/description', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn()
    render(
      <ItemList
        items={[item('1', 'Original title')]}
        onUpdate={onUpdate}
        onRemove={vi.fn()}
        onReorder={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Edit item' }))
    const titleInput = screen.getByDisplayValue('Original title')
    await user.clear(titleInput)
    await user.type(titleInput, 'Updated title')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onUpdate).toHaveBeenCalledWith('1', {
      title: 'Updated title',
      description: '',
    })
  })

  it('discards edits on cancel', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn()
    render(
      <ItemList
        items={[item('1', 'Original title')]}
        onUpdate={onUpdate}
        onRemove={vi.fn()}
        onReorder={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Edit item' }))
    await user.type(screen.getByDisplayValue('Original title'), ' extra')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onUpdate).not.toHaveBeenCalled()
    expect(screen.getByText('Original title')).toBeInTheDocument()
  })

  it('calls onRemove with the item id', async () => {
    const user = userEvent.setup()
    const onRemove = vi.fn()
    render(
      <ItemList
        items={[item('1', 'Only item')]}
        onUpdate={vi.fn()}
        onRemove={onRemove}
        onReorder={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Remove item' }))
    expect(onRemove).toHaveBeenCalledWith('1')
  })

  it('calls onReorder with the dragged and drop-target indices', () => {
    const onReorder = vi.fn()
    render(
      <ItemList
        items={[item('1', 'A'), item('2', 'B'), item('3', 'C')]}
        onUpdate={vi.fn()}
        onRemove={vi.fn()}
        onReorder={onReorder}
      />,
    )

    const rows = screen.getAllByText(/^[ABC]$/).map((el) => el.closest('div[draggable]')!)

    fireEvent.dragStart(rows[0]!)
    fireEvent.dragOver(rows[2]!)
    fireEvent.drop(rows[2]!)

    expect(onReorder).toHaveBeenCalledWith(0, 2)
  })

  it('does not call onReorder when dropped on its own original position', () => {
    const onReorder = vi.fn()
    render(
      <ItemList
        items={[item('1', 'A'), item('2', 'B')]}
        onUpdate={vi.fn()}
        onRemove={vi.fn()}
        onReorder={onReorder}
      />,
    )

    const rows = screen.getAllByText(/^[AB]$/).map((el) => el.closest('div[draggable]')!)

    fireEvent.dragStart(rows[0]!)
    fireEvent.dragOver(rows[0]!)
    fireEvent.drop(rows[0]!)

    expect(onReorder).not.toHaveBeenCalled()
  })
})
