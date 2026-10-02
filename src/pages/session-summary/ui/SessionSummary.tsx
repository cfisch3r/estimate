import { useNavigate } from 'react-router'
import { Button } from '../../../shared/ui'
import { ROUTES } from '../../../shared/lib/routes'
import { SessionSidebar } from '../../../widgets/session-sidebar'
import { useSessionStore, type Item } from '../../../entities/session'
import type { AggregateResult } from '../../../entities/estimate'

function isFinalized(item: Item): item is Item & { finalResult: AggregateResult } {
  return item.finalResult !== null
}

export function SessionSummary() {
  const items = useSessionStore((s) => s.items)
  const navigate = useNavigate()

  const finalizedItems = items.filter(isFinalized)

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '260px 1fr',
        gap: 'var(--space-6)',
        maxWidth: 1280,
        margin: '0 auto',
        padding: 'var(--space-6) var(--space-4)',
      }}
    >
      <SessionSidebar scrollableList={false} />

      <div className="card" style={{ padding: 'var(--space-6)', gap: 'var(--space-5)' }}>
        <h1 style={{ margin: 0, fontWeight: 500, fontSize: 22, textAlign: 'center' }}>
          Summary
        </h1>

        {finalizedItems.length === 0 ? (
          <p className="card-body">No items finalized yet.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Best</th>
                <th>Most likely</th>
                <th>Worst</th>
              </tr>
            </thead>
            <tbody>
              {finalizedItems.map((item) => (
                <tr key={item.id}>
                  <td>{item.title}</td>
                  <td>{item.finalResult.min}</td>
                  <td>{item.finalResult.expected}</td>
                  <td>{item.finalResult.max}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'center' }}>
          <Button variant="secondary" onClick={() => navigate(ROUTES.workspace)}>
            Back to item
          </Button>
          <Button variant="secondary" onClick={() => navigate(ROUTES.history)}>
            View session history
          </Button>
        </div>
      </div>
    </div>
  )
}
