import { useState } from 'react'
import {
  Button,
  Card,
  CardKicker,
  Field,
  FieldLabel,
  Input,
  RadioTile,
  Select,
} from '../components'
import { useSessionStore } from '../state/store'
import { generateSessionCode, useNetworkSession } from '../network'
import { ItemList } from './ItemList'
import type { EstimationUnit } from '../calc'

export function CreateSession() {
  const sessionName = useSessionStore((s) => s.sessionName)
  const unit = useSessionStore((s) => s.unit)
  const items = useSessionStore((s) => s.items)
  const mode = useSessionStore((s) => s.mode)
  const setSessionName = useSessionStore((s) => s.setSessionName)
  const setUnit = useSessionStore((s) => s.setUnit)
  const setMode = useSessionStore((s) => s.setMode)
  const addItem = useSessionStore((s) => s.addItem)
  const updateItem = useSessionStore((s) => s.updateItem)
  const removeItem = useSessionStore((s) => s.removeItem)
  const reorderItems = useSessionStore((s) => s.reorderItems)
  const createSession = useSessionStore((s) => s.createSession)
  const createLiveSession = useSessionStore((s) => s.createLiveSession)
  const goToScreen = useSessionStore((s) => s.goToScreen)
  const { connect } = useNetworkSession()

  const [newItemTitle, setNewItemTitle] = useState('')

  const canCreate = sessionName.trim().length > 0 && items.length > 0

  function handleAddItem() {
    if (newItemTitle.trim().length === 0) return
    addItem(newItemTitle)
    setNewItemTitle('')
  }

  function handleCreate() {
    if (!canCreate) return
    if (mode === 'live') {
      const code = generateSessionCode()
      createLiveSession(code)
      connect(code)
    } else {
      createSession()
    }
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
        <CardKicker>Mode</CardKicker>
        <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
          <RadioTile
            name="mode"
            value="manual"
            checked={mode === 'manual'}
            onChange={() => setMode('manual')}
            label="Manual entry"
            description="You record the group's agreed best / likely / worst for each item."
          />
          <RadioTile
            name="mode"
            value="live"
            checked={mode === 'live'}
            onChange={() => setMode('live')}
            label="Live collaborative"
            description="Participants join with a code and submit their own estimates in real time."
          />
        </div>
      </Card>

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

      <Button variant="primary" block disabled={!canCreate} onClick={handleCreate}>
        {mode === 'live' ? 'Create live session' : 'Create session'}
      </Button>

      <Button variant="ghost" onClick={() => goToScreen('join')}>
        Join a live session →
      </Button>
    </div>
  )
}
