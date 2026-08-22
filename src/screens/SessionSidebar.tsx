import { useState } from 'react'
import { DotsSixVerticalIcon } from '@phosphor-icons/react/dist/csr/DotsSixVertical'
import { NotebookIcon } from '@phosphor-icons/react/dist/csr/Notebook'
import type { Item, ScreenId } from '../state/types'

interface SessionSidebarProps {
  items: Item[]
  activeItemId: string | null
  currentScreen: ScreenId
  onSelect: (id: string) => void
  onReorder: (fromIndex: number, toIndex: number) => void
  onGoSummary: () => void
}

interface SidebarRowProps {
  item: Item
  isActive: boolean
  isDragged: boolean
  isDropTarget: boolean
  onSelect: () => void
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
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: SidebarRowProps) {
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
        opacity: isDragged ? 0.4 : 1,
        boxShadow: isDropTarget ? '0 0 0 2px var(--color-accent)' : undefined,
      }}
    >
      <DotsSixVerticalIcon size={14} className="session-sidebar-grip" />
      {isActive && <span className="session-sidebar-marker">▷</span>}
      <span>{item.title}</span>
    </div>
  )
}

export function SessionSidebar({
  items,
  activeItemId,
  currentScreen,
  onSelect,
  onReorder,
  onGoSummary,
}: SessionSidebarProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  const finalizedCount = items.filter((item) => item.finalResult !== null).length
  const onSummary = currentScreen === 'summary'

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
