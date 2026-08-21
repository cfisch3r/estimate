import { useState } from 'react'
import { Button, Card, CardKicker, Field, FieldLabel, Input, Select } from '../components'
import { useSessionStore } from '../state/store'
import { ItemList } from './ItemList'
import type { EstimationUnit } from '../calc'

export function CreateSession() {
  const sessionName = useSessionStore((s) => s.sessionName)
  const unit = useSessionStore((s) => s.unit)
  const items = useSessionStore((s) => s.items)
  const setSessionName = useSessionStore((s) => s.setSessionName)
  const setUnit = useSessionStore((s) => s.setUnit)
  const addItem = useSessionStore((s) => s.addItem)
  const updateItem = useSessionStore((s) => s.updateItem)
  const removeItem = useSessionStore((s) => s.removeItem)
  const reorderItems = useSessionStore((s) => s.reorderItems)
  const createSession = useSessionStore((s) => s.createSession)

  const [newItemTitle, setNewItemTitle] = useState('')

  function handleAddItem() {
    if (newItemTitle.trim().length === 0) return
    addItem(newItemTitle)
    setNewItemTitle('')
  }

  return (
    <div
      style={{ maxWidth: 640, margin: '0 auto', padding: 24, display: 'grid', gap: 16 }}
    >
      <div>
        <h1>New session</h1>
        <p className="text-muted">
          Name what you&apos;re estimating, list the items, and choose a unit.
        </p>
      </div>

      <Card elevation="sm">
        <CardKicker>Session</CardKicker>
        <Field>
          <FieldLabel htmlFor="session-name">Session name</FieldLabel>
          <Input
            id="session-name"
            value={sessionName}
            onChange={(e) => setSessionName(e.target.value)}
            placeholder="Sprint 14 backlog refinement"
          />
        </Field>
      </Card>

      <Card elevation="sm">
        <CardKicker>Items</CardKicker>
        <ItemList
          items={items}
          onUpdate={updateItem}
          onRemove={removeItem}
          onReorder={reorderItems}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <Input
            value={newItemTitle}
            onChange={(e) => setNewItemTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddItem()
            }}
            placeholder="Add an item"
          />
          <Button variant="secondary" onClick={handleAddItem}>
            Add
          </Button>
        </div>
      </Card>

      <Card elevation="sm">
        <CardKicker>Unit</CardKicker>
        <Field>
          <FieldLabel htmlFor="unit">Estimate values in</FieldLabel>
          <Select
            id="unit"
            value={unit}
            onChange={(e) => setUnit(e.target.value as EstimationUnit)}
          >
            <option value="hours">Hours</option>
            <option value="days">Days</option>
            <option value="weeks">Weeks</option>
          </Select>
        </Field>
      </Card>

      <Button
        variant="primary"
        block
        disabled={sessionName.trim().length === 0 || items.length === 0}
        onClick={createSession}
      >
        Create session
      </Button>
    </div>
  )
}
