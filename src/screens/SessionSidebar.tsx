import { useState } from 'react'
import { DotsSixVerticalIcon } from '@phosphor-icons/react/dist/csr/DotsSixVertical'
import { NotebookIcon } from '@phosphor-icons/react/dist/csr/Notebook'
import { CheckCircleIcon } from '@phosphor-icons/react/dist/csr/CheckCircle'
import { PlusIcon } from '@phosphor-icons/react/dist/csr/Plus'
import { XIcon } from '@phosphor-icons/react/dist/csr/X'
import { Button, Input } from '../components'
import type { Item, ScreenId } from '../state/types'

interface SessionSidebarProps {
  items: Item[]
  activeItemId: string | null
  currentScreen: ScreenId
  onSelect: (id: string) => void
  onReorder: (fromIndex: number, toIndex: number) => void
  onRemove: (id: string) => void
  onAdd: (title: string) => void
  onGoSummary: () => void
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

  return (
    <div
      draggable
      data-active={isActive}
      onClick={onSelect}
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
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          minWidth: 0,
          overflow: 'hidden',
        }}
      >
        <DotsSixVerticalIcon size={14} className="session-sidebar-grip" />
        {isFinalized && (
          <CheckCircleIcon
            size={13}
            weight="fill"
            style={{ color: 'var(--color-accent-300)', flex: 'none' }}
          />
        )}
        {isActive && !isFinalized && <span className="session-sidebar-marker">▷</span>}
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {item.title}
        </span>
      </span>
      <Button
        variant="ghost"
        icon
        aria-label="Remove item"
        style={{ width: 24, height: 24, minWidth: 24, flex: 'none' }}
        onClick={(e) => {
          e.stopPropagation()
          onRemove()
        }}
      >
        <XIcon size={12} />
      </Button>
    </div>
  )
}

export function SessionSidebar({
  items,
  activeItemId,
  currentScreen,
  onSelect,
  onReorder,
  onRemove,
  onAdd,
  onGoSummary,
}: SessionSidebarProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [newItemTitle, setNewItemTitle] = useState('')

  const finalizedCount = items.filter((item) => item.finalResult !== null).length
  const onSummary = currentScreen === 'summary'

  function handleAdd() {
    if (newItemTitle.trim().length === 0) return
    onAdd(newItemTitle)
    setNewItemTitle('')
  }

  return (
    <aside className="session-sidebar">
      <div className="session-sidebar-header">
        <span className="session-sidebar-title">Items</span>
        <span className="session-sidebar-progress">
          {finalizedCount}/{items.length} finalized
        </span>
      </div>
      <div className="session-sidebar-rows">
        {items.map((item, index) => (
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
        ))}
      </div>
      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
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
      <a
        href="#"
        className={`session-sidebar-summary-link${onSummary ? ' session-sidebar-summary-link-current' : ''}`}
        onClick={(e) => {
          e.preventDefault()
          onGoSummary()
        }}
      >
        <NotebookIcon size={15} />
        Summary
      </a>
    </aside>
  )
}
