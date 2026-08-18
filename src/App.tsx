import { useState } from 'react'
import { PencilSimple, Play, X } from '@phosphor-icons/react'
import {
  Button,
  Card,
  CardKicker,
  CardTitle,
  CardBody,
  CardMeta,
  Field,
  FieldLabel,
  Input,
  Textarea,
  Select,
  RadioTile,
  Tag,
} from './components'

/** Temporary kitchen-sink render for checking Nocturne fidelity (M1). Removed once M3's
 *  real screens exist. */
function App() {
  const [mode, setMode] = useState<'live' | 'manual'>('live')

  return (
    <div
      style={{ maxWidth: 640, margin: '0 auto', padding: 24, display: 'grid', gap: 16 }}
    >
      <h1>EstiMate — kitchen sink</h1>

      <Card elevation="sm">
        <CardKicker>Buttons</CardKicker>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button variant="primary">Create session</Button>
          <Button variant="secondary">Cancel</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="secondary" icon aria-label="Edit item">
            <PencilSimple size={16} />
          </Button>
          <Button variant="secondary" icon aria-label="Remove item">
            <X size={16} />
          </Button>
          <Button variant="primary" disabled>
            Disabled
          </Button>
        </div>
      </Card>

      <Card elevation="sm">
        <CardKicker>Tags</CardKicker>
        <div style={{ display: 'flex', gap: 8 }}>
          <Tag variant="accent">Accent</Tag>
          <Tag variant="accent-2">Accent 2</Tag>
          <Tag variant="neutral">Neutral</Tag>
          <Tag variant="outline">Outline</Tag>
        </div>
      </Card>

      <Card elevation="sm">
        <CardKicker>Fields</CardKicker>
        <Field>
          <FieldLabel htmlFor="name">Session name</FieldLabel>
          <Input id="name" placeholder="Sprint 14 backlog refinement" />
        </Field>
        <Field>
          <FieldLabel htmlFor="notes">Notes</FieldLabel>
          <Textarea id="notes" rows={4} placeholder="Markdown supported" />
        </Field>
        <Field>
          <FieldLabel htmlFor="unit">Unit</FieldLabel>
          <Select id="unit" defaultValue="days">
            <option value="hours">Hours</option>
            <option value="days">Days</option>
            <option value="weeks">Weeks</option>
          </Select>
        </Field>
      </Card>

      <Card elevation="sm">
        <CardKicker>Mode picker (RadioTile)</CardKicker>
        <div style={{ display: 'flex', gap: 8 }}>
          <RadioTile
            name="mode"
            label="Live Collaborative"
            description="Team joins & submits live"
            checked={mode === 'live'}
            onChange={() => setMode('live')}
          />
          <RadioTile
            name="mode"
            label="Manual Entry"
            description="Facilitator types values in directly"
            checked={mode === 'manual'}
            onChange={() => setMode('manual')}
          />
        </div>
      </Card>

      <Card elevation="sm">
        <CardKicker>Item row</CardKicker>
        <CardTitle>
          <Play size={14} style={{ marginRight: 6 }} />
          Migrate auth service
        </CardTitle>
        <CardBody>Move session storage off the legacy token format.</CardBody>
        <CardMeta>3 estimates submitted</CardMeta>
      </Card>
    </div>
  )
}

export default App
