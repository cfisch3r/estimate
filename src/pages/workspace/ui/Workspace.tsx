import { Card } from '../../../shared/ui'
import { SessionSidebar } from '../../../widgets/session-sidebar'
import {
  useSessionStore,
  useConnectionStore,
  useRoundStore,
  useNetworkSession,
} from '../../../entities/session'
import { LiveFacilitatorPanel, LiveSessionStrip } from '../../../features/reveal-results'
import { useItemNavigation } from '../model/useItemNavigation'
import { ActiveItemPanel } from './ActiveItemPanel'
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
  const participantNames = useConnectionStore((s) => s.participantNames)
  const finalizeItem = useRoundStore((s) => s.finalizeItem)
  const finalizeLiveItem = useRoundStore((s) => s.finalizeLiveItem)
  const revealRound = useRoundStore((s) => s.revealRound)
  const retryRound = useRoundStore((s) => s.retryRound)
  const { connect } = useNetworkSession()
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
            onReconnect={() => connect(sessionId)}
          />
        )}

        <WorkspaceTopBar />

        <div className="workspace-body">
          <div className="workspace-sidebar-col">
            <SessionSidebar hideSummaryButton />
          </div>

          <div className="workspace-detail-col">
            {activeItem ? (
              // Reveal/Retry are local store mutations only — the store
              // subscription in NetworkProvider broadcasts the resulting snapshot
              // (revealed/round changed) to participants, so there's no separate
              // wire event to send here.
              isLiveFacilitator ? (
                <LiveFacilitatorPanel
                  key={activeItem.id}
                  item={activeItem}
                  unit={unit}
                  isFirst={isFirst}
                  isLast={isLast}
                  participantNames={participantNames}
                  onReveal={revealRound}
                  onRetry={retryRound}
                  onFinalize={finalizeLiveItem}
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
