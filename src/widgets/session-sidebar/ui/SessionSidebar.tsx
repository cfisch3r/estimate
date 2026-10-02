import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { DotsSixVerticalIcon } from '@phosphor-icons/react/dist/csr/DotsSixVertical'
import { NotebookIcon } from '@phosphor-icons/react/dist/csr/Notebook'
import { CheckCircleIcon } from '@phosphor-icons/react/dist/csr/CheckCircle'
import { PlusIcon } from '@phosphor-icons/react/dist/csr/Plus'
import { XIcon } from '@phosphor-icons/react/dist/csr/X'
import { Button, Input } from '../../../shared/ui'
import { useConfirmArm } from '../../../shared/lib/useConfirmArm'
import { useNavigate, useLocation } from 'react-router'
import { ROUTES } from '../../../shared/lib/routes'
import { useSessionStore, type Item } from '../../../entities/session'

interface SessionSidebarProps {
  /** Workspace's merged top bar carries its own Summary button now, so it hides
   *  this one; SessionSummary (which has no top bar) still uses the built-in one. */
  hideSummaryButton?: boolean
  /** The Workspace redesign's fixed-height, independently-scrolling item list —
   *  scoped to Workspace only (the handoff didn't cover SessionSummary), so
   *  SessionSummary opts out and keeps its original unbounded-height list. */
  scrollableList?: boolean
}

interface SidebarRowProps {
  item: Item
  isActive: boolean
  isDragged: boolean
  isDropTarget: boolean
  onSelect: () => void
  onRemove: () => void
  onDragStart: () => void
  onDragOver: () => void
  onDrop: () => void
  onDragEnd: () => void
}

function SidebarRow({
  item,
  isActive,
  isDragged,
  isDropTarget,
  onSelect,
  onRemove,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: SidebarRowProps) {
  const isFinalized = item.finalResult !== null
  const {
    armed,
    handleClick: armAndConfirmRemove,
    ref: removeRef,
  } = useConfirmArm<HTMLButtonElement>(onRemove)

  return (
    <div
      draggable
      data-active={isActive}
      onDragStart={onDragStart}
      onDragOver={(e) => {
        e.preventDefault()
        onDragOver()
      }}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`session-sidebar-row${isActive ? ' session-sidebar-row-active' : ''}`}
      style={{
        justifyContent: 'space-between',
        opacity: isDragged ? 0.4 : 1,
        boxShadow: isDropTarget ? '0 0 0 2px var(--color-accent)' : undefined,
      }}
    >
      {/* A native button, not the row div, carries the select click/keyboard
       *  handler — a clickable div isn't keyboard-operable or announced as
       *  interactive to assistive tech, and the remove button below must stay
       *  a sibling rather than nested inside it. */}
      <button type="button" className="session-sidebar-row-select" onClick={onSelect}>
        <DotsSixVerticalIcon size={14} className="session-sidebar-grip" />
        {isFinalized && (
          <CheckCircleIcon
            size={13}
            weight="fill"
            style={{ color: 'var(--color-accent-300)', flex: 'none' }}
          />
        )}
        {isActive && !isFinalized && <span className="session-sidebar-marker">▷</span>}
        <span className="session-sidebar-row-label">{item.title}</span>
      </button>
      <Button
        ref={removeRef}
        variant="ghost"
        icon={!armed}
        aria-label={armed ? 'Confirm delete' : 'Remove item'}
        style={{
          width: armed ? 'auto' : 24,
          height: 24,
          minWidth: 24,
          flex: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-1)',
          padding: armed ? '0 var(--space-2)' : undefined,
          color: armed ? 'var(--color-warning)' : undefined,
        }}
        onClick={armAndConfirmRemove}
      >
        <XIcon size={12} weight={armed ? 'bold' : 'regular'} />
        {armed && 'Confirm delete'}
      </Button>
    </div>
  )
}

export function SessionSidebar({
  hideSummaryButton = false,
  scrollableList = true,
}: SessionSidebarProps) {
  const items = useSessionStore((s) => s.items)
  const activeItemId = useSessionStore((s) => s.activeItemId)
  const onSelect = useSessionStore((s) => s.selectItem)
  const onReorder = useSessionStore((s) => s.reorderItems)
  const onRemove = useSessionStore((s) => s.removeItem)
  const onAdd = useSessionStore((s) => s.addItem)
  const navigate = useNavigate()
  const location = useLocation()
  // Drives the Summary button's highlighted state.
  const isSummaryScreen = location.pathname === ROUTES.summary
  const onGoSummary = () => navigate(ROUTES.summary)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [newItemTitle, setNewItemTitle] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const prevItemCount = useRef(items.length)
  const [isScrollCapped, setIsScrollCapped] = useState(false)

  const finalizedCount = items.filter((item) => item.finalResult !== null).length
  const onSummary = isSummaryScreen

  // A newly added item lands at the bottom of a capped-height, scrollable list
  // (see session-sidebar.css) — without this it's added out of view and only
  // visible after the user manually scrolls down.
  useEffect(() => {
    if (items.length > prevItemCount.current) {
      const el = scrollRef.current
      if (el) el.scrollTop = el.scrollHeight
    }
    prevItemCount.current = items.length
  }, [items.length])

  // The bottom fade (session-sidebar.css) only makes sense once the list has
  // hit its max-height and is actually scrollable — otherwise it would cover
  // the last row's own content in a short, shrink-to-fit list.
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (el) setIsScrollCapped(el.scrollHeight > el.clientHeight)
  }, [items.length])

  function handleAdd() {
    if (newItemTitle.trim().length === 0) return
    onAdd(newItemTitle)
    setNewItemTitle('')
  }

  const rows = items.map((item, index) => (
    <SidebarRow
      key={item.id}
      item={item}
      isActive={!onSummary && item.id === activeItemId}
      isDragged={dragIndex === index}
      isDropTarget={dragOverIndex === index && dragIndex !== index}
      onSelect={() => onSelect(item.id)}
      onRemove={() => onRemove(item.id)}
      onDragStart={() => setDragIndex(index)}
      onDragOver={() => setDragOverIndex(index)}
      onDrop={() => {
        if (dragIndex !== null && dragIndex !== index) {
          onReorder(dragIndex, index)
        }
        setDragIndex(null)
        setDragOverIndex(null)
      }}
      onDragEnd={() => {
        setDragIndex(null)
        setDragOverIndex(null)
      }}
    />
  ))

  return (
    <aside className="session-sidebar">
      <div className="session-sidebar-header">
        <span className="session-sidebar-title">Items</span>
        <span className="session-sidebar-progress">
          {finalizedCount}/{items.length} finalized
        </span>
      </div>
      {scrollableList ? (
        <div
          className={`session-sidebar-scroll${isScrollCapped ? ' session-sidebar-scroll--capped' : ''}`}
          ref={scrollRef}
        >
          <div className="session-sidebar-rows">{rows}</div>
        </div>
      ) : (
        <div className="session-sidebar-rows">{rows}</div>
      )}
      <div style={{ display: 'flex', gap: 'var(--space-2)', flex: 'none' }}>
        <Input
          value={newItemTitle}
          onChange={(e) => setNewItemTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAdd()
          }}
          placeholder="Add an item"
        />
        <Button variant="secondary" icon aria-label="Add item" onClick={handleAdd}>
          <PlusIcon size={14} />
        </Button>
      </div>
      {!hideSummaryButton && (
        <Button variant={onSummary ? 'primary' : 'secondary'} block onClick={onGoSummary}>
          <NotebookIcon size={15} />
          Summary
        </Button>
      )}
    </aside>
  )
}
