import { Button, Card, CardTitle, CardBody, CardMeta } from '../components'
import { useSessionStore } from '../state/store'
import type { AggregateResult } from '../calc'
import type { Item } from '../state/types'

interface RangeBarProps {
  min: number
  max: number
  expected: number
  ci90: number
}

function RangeBar({ min, max, expected, ci90 }: RangeBarProps) {
  const span = max - min
  const pct = (value: number) =>
    span <= 0 ? 50 : Math.min(100, Math.max(0, ((value - min) / span) * 100))

  return (
    <div
      style={{
        position: 'relative',
        height: 6,
        background: 'var(--color-accent-800)',
        borderRadius: 'var(--radius-sm)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: `${pct(expected)}%`,
          top: -2,
          bottom: -2,
          width: 2,
          background: 'var(--color-accent)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: `${pct(ci90)}%`,
          top: -2,
          bottom: -2,
          width: 2,
          background: 'var(--color-text)',
        }}
      />
    </div>
  )
}

function isFinalized(item: Item): item is Item & { finalResult: AggregateResult } {
  return item.finalResult !== null
}

export function SessionSummary() {
  const sessionName = useSessionStore((s) => s.sessionName)
  const unit = useSessionStore((s) => s.unit)
  const items = useSessionStore((s) => s.items)
  const goToScreen = useSessionStore((s) => s.goToScreen)

  const finalizedItems = items.filter(isFinalized)

  return (
    <div
      style={{ maxWidth: 760, margin: '0 auto', padding: 24, display: 'grid', gap: 16 }}
    >
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <h1>{sessionName}</h1>
        <Button variant="secondary" onClick={() => goToScreen('history')}>
          View session history
        </Button>
      </div>

      {finalizedItems.length === 0 ? (
        <Card elevation="sm">
          <CardBody>No items finalized yet.</CardBody>
        </Card>
      ) : (
        finalizedItems.map((item) => (
          <Card key={item.id} elevation="sm">
            <CardTitle>{item.title}</CardTitle>
            <RangeBar
              min={item.finalResult.min}
              max={item.finalResult.max}
              expected={item.finalResult.expected}
              ci90={item.finalResult.ci90}
            />
            <CardMeta>
              {`${item.finalResult.min}–${item.finalResult.max} ${unit} · expected ${item.finalResult.expected} · CI90 ${item.finalResult.ci90.toFixed(1)}`}
            </CardMeta>
          </Card>
        ))
      )}
    </div>
  )
}
