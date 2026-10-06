import { describe, expect, it } from 'vitest'
import type { ComponentProps } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { SessionSidebar } from './SessionSidebar'
import { useSessionStore, type Item } from '../../../entities/session'

function item(id: string, title: string, finalResult: Item['finalResult'] = null): Item {
  return {
    id,
    title,
    description: '',
    notes: '',
    finalResult,
    submissions: [],
    revealed: false,
    round: 0,
  }
}

const finalized = { min: 1, expected: 2, max: 3, ci90: 3 }

function renderSidebar(
  state: Partial<ReturnType<typeof useSessionStore.getState>> = {},
  props: ComponentProps<typeof SessionSidebar> = {},
) {
  useSessionStore.setState({
    items: [item('1', 'A'), item('2', 'B')],
    activeItemId: '1',
    ...state,
  })
  return render(<SessionSidebar {...props} />)
}

describe('SessionSidebar', () => {
  it('has no axe violations', async () => {
    const { container } = renderSidebar()

    // color-contrast needs real layout/computed font metrics jsdom doesn't
    // provide; real-browser contrast coverage lives in the e2e axe pass.
    expect(
      await axe(container, { rules: { 'color-contrast': { enabled: false } } }),
    ).toHaveNoViolations()
  })

  it('shows the finalized/total count', () => {
    renderSidebar({
      items: [item('1', 'A', finalized), item('2', 'B'), item('3', 'C')],
      activeItemId: '2',
    })

    expect(screen.getByText('1/3 finalized')).toBeInTheDocument()
  })

  it('marks the active item row distinctly from inactive rows', () => {
    renderSidebar({ activeItemId: '1' })

    expect(screen.getByText('A').closest('[data-active]')).toHaveAttribute(
      'data-active',
      'true',
    )
    expect(screen.getByText('B').closest('[data-active]')).toHaveAttribute(
      'data-active',
      'false',
    )
  })

  it('exposes the active row to assistive tech with aria-current and hides the decorative marker', () => {
    renderSidebar({ activeItemId: '1' })

    const active = screen.getByRole('button', { name: 'A' })
    expect(active).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('button', { name: 'B' })).not.toHaveAttribute('aria-current')
    expect(screen.getByText('▷')).toHaveAttribute('aria-hidden', 'true')
  })

  it('sets no aria-current when the active highlight is turned off', () => {
    renderSidebar({ activeItemId: '1' }, { highlightActive: false })

    for (const button of screen.getAllByRole('button', { name: /^(A|B)$/ })) {
      expect(button).not.toHaveAttribute('aria-current')
    }
  })

  it('selects the clicked item in the session store', async () => {
    const user = userEvent.setup()
    renderSidebar()

    await user.click(screen.getByText('B'))

    expect(useSessionStore.getState().activeItemId).toBe('2')
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

  it('requires a second click to remove an item, and never also selects it', async () => {
    const user = userEvent.setup()
    renderSidebar({ activeItemId: '1' })

    const bRow = screen.getByText('B').closest('.session-sidebar-row')!
    await user.click(bRow.querySelector('button[aria-label="Remove item"]')!)
    expect(useSessionStore.getState().items).toHaveLength(2)

    await user.click(bRow.querySelector('button[aria-label="Confirm delete"]')!)

    expect(useSessionStore.getState().items.map((i) => i.id)).toEqual(['1'])
    expect(useSessionStore.getState().activeItemId).toBe('1')
  })

  it('requires a second click to remove a finalized item', async () => {
    const user = userEvent.setup()
    renderSidebar({ items: [item('1', 'A'), item('2', 'B', finalized)] })

    const bRow = screen.getByText('B').closest('.session-sidebar-row')!
    const removeButton = bRow.querySelector('button[aria-label="Remove item"]')!

    await user.click(removeButton)
    expect(useSessionStore.getState().items).toHaveLength(2)
    expect(bRow.querySelector('button[aria-label="Confirm delete"]')).toBeInTheDocument()

    await user.click(bRow.querySelector('button[aria-label="Confirm delete"]')!)
    expect(useSessionStore.getState().items.map((i) => i.id)).toEqual(['1'])
  })

  it('clears the confirm state on an outside click without removing', async () => {
    const user = userEvent.setup()
    renderSidebar({ items: [item('1', 'A'), item('2', 'B', finalized)] })

    const bRow = screen.getByText('B').closest('.session-sidebar-row')!
    await user.click(bRow.querySelector('button[aria-label="Remove item"]')!)
    expect(bRow.querySelector('button[aria-label="Confirm delete"]')).toBeInTheDocument()

    await user.click(screen.getByText('A'))

    expect(bRow.querySelector('button[aria-label="Remove item"]')).toBeInTheDocument()
    expect(useSessionStore.getState().items).toHaveLength(2)
  })

  it('adds the typed title to the session and clears the input', async () => {
    const user = userEvent.setup()
    renderSidebar()

    const input = screen.getByPlaceholderText('Add an item')
    await user.type(input, 'New item')
    await user.click(screen.getByRole('button', { name: 'Add item' }))

    expect(useSessionStore.getState().items.map((i) => i.title)).toEqual([
      'A',
      'B',
      'New item',
    ])
    expect(input).toHaveValue('')
  })

  it('reorders the session items when a row is dragged onto another', () => {
    renderSidebar({ items: [item('1', 'A'), item('2', 'B'), item('3', 'C')] })

    const rows = screen.getAllByText(/^[ABC]$/).map((el) => el.closest('div[draggable]')!)

    fireEvent.dragStart(rows[0]!)
    fireEvent.dragOver(rows[2]!)
    fireEvent.drop(rows[2]!)

    expect(useSessionStore.getState().items.map((i) => i.id)).toEqual(['2', '3', '1'])
  })

  it('shows no row as active when highlightActive is off', () => {
    renderSidebar({ activeItemId: '1' }, { highlightActive: false })

    expect(screen.getByText('A').closest('[data-active]')).toHaveAttribute(
      'data-active',
      'false',
    )
  })
})
