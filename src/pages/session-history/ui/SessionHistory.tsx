import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Card, CardTitle, CardBody, CardMeta, Input } from '../../../shared/ui'
import { ROUTES } from '../../../shared/lib/routes'
import { useSessionStore } from '../../../entities/session'

export function SessionHistory() {
  const sessionName = useSessionStore((s) => s.sessionName)
  const items = useSessionStore((s) => s.items)
  const unit = useSessionStore((s) => s.unit)
  const navigate = useNavigate()

  const [search, setSearch] = useState('')

  // Session name is now an optional free-text field (the mode-select flow no
  // longer forces one), so fall back to a placeholder for display.
  const displayName = sessionName.trim() || 'Untitled session'
  const hasFinalizedItem = items.some((item) => item.finalResult !== null)
  const matchesSearch = displayName.toLowerCase().includes(search.toLowerCase())
  const showCurrentSession = hasFinalizedItem && matchesSearch

  return (
    <div
      style={{ maxWidth: 640, margin: '0 auto', padding: 24, display: 'grid', gap: 16 }}
    >
      <h1>Session history</h1>
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search sessions"
      />

      {showCurrentSession ? (
        <Card
          elevation="sm"
          style={{ cursor: 'pointer' }}
          onClick={() => navigate(ROUTES.summary)}
        >
          <CardTitle>{`${displayName} (current)`}</CardTitle>
          <CardMeta>{`Manual Entry · ${items.length} item${items.length === 1 ? '' : 's'} · ${unit}`}</CardMeta>
        </Card>
      ) : (
        <Card elevation="sm">
          <CardBody>No past sessions yet.</CardBody>
        </Card>
      )}
    </div>
  )
}
