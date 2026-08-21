import { useState } from 'react'
import { DotsSixVerticalIcon } from '@phosphor-icons/react/dist/csr/DotsSixVertical'
import { PencilSimpleIcon } from '@phosphor-icons/react/dist/csr/PencilSimple'
import { XIcon } from '@phosphor-icons/react/dist/csr/X'
import { Button, Field, Input, Textarea } from '../components'
import type { Item } from '../state/types'

interface ItemListProps {
  items: Item[]
  onUpdate: (id: string, updates: { title: string; description: string }) => void
  onRemove: (id: string) => void
  onReorder: (fromIndex: number, toIndex: number) => void
}

interface ItemRowProps {
  item: Item
  isEditing: boolean
  isDragged: boolean
  isDropTarget: boolean
  onStartEdit: () => void
  onCancelEdit: () => void
  onSave: (title: string, description: string) => void
  onRemove: () => void
  onDragStart: () => void
  onDragOver: () => void
  onDrop: () => void
  onDragEnd: () => void
}

function ItemRow({
  item,
  isEditing,
  isDragged,
  isDropTarget,
  onStartEdit,
  onCancelEdit,
  onSave,
  onRemove,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: ItemRowProps) {
  const [editTitle, setEditTitle] = useState(item.title)
  const [editDesc, setEditDesc] = useState(item.description)

  if (isEditing) {
    return (
      <div className="card" style={{ gap: 8 }}>
        <Field>
          <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
        </Field>
        <Field>
          <Textarea
            rows={4}
            placeholder="Markdown supported"
            value={editDesc}
            onChange={(e) => setEditDesc(e.target.value)}
          />
        </Field>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={onCancelEdit}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => onSave(editTitle, editDesc)}>
            Save
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => {
        e.preventDefault()
        onDragOver()
      }}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 4px',
        opacity: isDragged ? 0.4 : 1,
        boxShadow: isDropTarget ? '0 0 0 2px var(--color-accent)' : undefined,
        borderRadius: 'var(--radius-sm)',
      }}
    >
      <DotsSixVerticalIcon size={16} style={{ cursor: 'grab', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div>{item.title}</div>
        {item.description && <div className="text-muted">{item.description}</div>}
      </div>
      <Button variant="secondary" icon aria-label="Edit item" onClick={onStartEdit}>
        <PencilSimpleIcon size={16} />
      </Button>
      <Button variant="secondary" icon aria-label="Remove item" onClick={onRemove}>
        <XIcon size={16} />
      </Button>
    </div>
  )
}

export function ItemList({ items, onUpdate, onRemove, onReorder }: ItemListProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {items.map((item, index) => (
        <ItemRow
          key={item.id}
          item={item}
          isEditing={editingId === item.id}
          isDragged={dragIndex === index}
          isDropTarget={dragOverIndex === index && dragIndex !== index}
          onStartEdit={() => setEditingId(item.id)}
          onCancelEdit={() => setEditingId(null)}
          onSave={(title, description) => {
            onUpdate(item.id, { title, description })
            setEditingId(null)
          }}
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
  )
}
