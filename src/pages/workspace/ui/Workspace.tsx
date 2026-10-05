import './workspace.css'
import { Card } from '../../../shared/ui'
import { SessionSidebar } from '../../../widgets/session-sidebar'
import {
  useSessionStore,
  useConnectionStore,
  useRoundStore,
} from '../../../entities/session'
import { LiveFacilitatorPanel } from '../../../features/reveal-results'
import { useReconnect } from '../../../features/session-lifecycle'
import { useItemNavigation } from '../model/useItemNavigation'
import { ActiveItemPanel } from './ActiveItemPanel'
import { LiveSessionStrip } from './LiveSessionStrip'
import { WorkspaceEmptyState } from './WorkspaceEmptyState'
import { WorkspaceTopBar } from './WorkspaceTopBar'

export function Workspace() {
  const unit = useSessionStore((s) => s.unit)
  const mode = useConnectionStore((s) => s.mode)
  const role = useConnectionStore((s) => s.role)
  const sessionId = useConnectionStore((s) => s.sessionId)
  const connectionStatus = useConnectionStore((s) => s.connectionStatus)
  const peerCount = useConnectionStore((s) => s.peerCount)
  const hasEverConnected = useConnectionStore((s) => s.hasEverConnected)
  const finalizeItem = useRoundStore((s) => s.finalizeItem)
  const { reconnect } = useReconnect()
  const { itemCount, activeItem, isFirst, isLast, allFinalized, goPrev, advance } =
    useItemNavigation()

  const isLiveFacilitator = mode === 'live' && role === 'facilitator'

  return (
    <div
      style={{
        maxWidth: 1280,
        margin: '0 auto',
        padding: 'var(--space-6) var(--space-4)',
      }}
    >
      <Card elevation="sm" className="workspace-card">
        {mode === 'live' && sessionId && (
          <LiveSessionStrip
            sessionId={sessionId}
            connectionStatus={connectionStatus}
            peerCount={peerCount}
            hasEverConnected={hasEverConnected}
            onReconnect={reconnect}
          />
        )}

        <WorkspaceTopBar />

        <div className="workspace-body">
          <div className="workspace-sidebar-col">
            <SessionSidebar hideSummaryButton />
          </div>

          <div className="workspace-detail-col">
            {activeItem ? (
              isLiveFacilitator ? (
                <LiveFacilitatorPanel
                  key={activeItem.id}
                  item={activeItem}
                  unit={unit}
                  isFirst={isFirst}
                  isLast={isLast}
                  onAdvance={advance}
                  onNavigatePrev={goPrev}
                />
              ) : (
                <ActiveItemPanel
                  key={activeItem.id}
                  item={activeItem}
                  unit={unit}
                  isFirst={isFirst}
                  isLast={isLast}
                  onFinalize={finalizeItem}
                  onAdvance={advance}
                  onNavigatePrev={goPrev}
                />
              )
            ) : (
              <WorkspaceEmptyState itemCount={itemCount} allFinalized={allFinalized} />
            )}
          </div>
        </div>
      </Card>
    </div>
  )
}
