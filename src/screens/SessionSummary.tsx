import { Button, Card, CardTitle, CardBody, RangeBar } from '../components'
import { useSessionStore } from '../state/store'
import { UNIT_SUFFIX } from '../calc'
import type { AggregateResult } from '../calc'
import type { Item } from '../state/types'

function isFinalized(item: Item): item is Item & { finalResult: AggregateResult } {
  return item.finalResult !== null
}

export function SessionSummary() {
  const sessionName = useSessionStore((s) => s.sessionName)
  const unit = useSessionStore((s) => s.unit)
  const items = useSessionStore((s) => s.items)
  const goToScreen = useSessionStore((s) => s.goToScreen)
  const selectItem = useSessionStore((s) => s.selectItem)

  const finalizedItems = items.filter(isFinalized)

  function editItem(id: string) {
    selectItem(id)
    goToScreen('session')
  }

  return (
    <div
      style={{ maxWidth: 760, margin: '0 auto', padding: 24, display: 'grid', gap: 16 }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
      >
        <div>
          <h1>{sessionName}</h1>
          {finalizedItems.length > 0 && (
            <div className="range-bar-legend">
              <span>
                <i className="range-bar-legend-dot" /> Expected
              </span>
              <span>
                <i className="range-bar-legend-dash" /> 90% confidence
              </span>
            </div>
          )}
        </div>
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
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 8,
              }}
            >
              <CardTitle>{item.title}</CardTitle>
              <Button variant="ghost" onClick={() => editItem(item.id)}>
                Edit
              </Button>
            </div>
            <RangeBar
              min={item.finalResult.min}
              max={item.finalResult.max}
              expected={item.finalResult.expected}
              ci90={item.finalResult.ci90}
              unitSuffix={UNIT_SUFFIX[unit]}
            />
          </Card>
        ))
      )}
    </div>
  )
}
