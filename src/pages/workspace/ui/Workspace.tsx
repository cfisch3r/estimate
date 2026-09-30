import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { PencilSimpleIcon } from '@phosphor-icons/react/dist/csr/PencilSimple'
import { NotebookIcon } from '@phosphor-icons/react/dist/csr/Notebook'
import { ListChecksIcon } from '@phosphor-icons/react/dist/csr/ListChecks'
import {
  Button,
  Card,
  CardTitle,
  CardBody,
  Input,
  Select,
  GuardNote,
  GroupBox,
  NavRow,
} from '../../../shared/ui'
import { PHASE_INFO, RANGE_INFO } from '../../../shared/copy'
import { useSingleInfoPopover } from '../../../shared/lib/useSingleInfoPopover'
import { SessionSidebar } from '../../../widgets/session-sidebar'
import {
  useSessionStore,
  useNetworkSession,
  ItemDetailShell,
  type FinalizeResult,
  type Item,
} from '../../../entities/session'
import {
  checkSymmetricRange,
  computeCI90,
  createEstimate,
  RangeBar,
  UNIT_SUFFIX,
  type EstimationUnit,
} from '../../../entities/estimate'
import {
  PhasePicker,
  ThreePointEstimateFields,
  UncertaintyGuidanceNotes,
  usePhaseGuidance,
} from '../../../features/estimate-round'
import { LiveFacilitatorPanel, LiveSessionStrip } from '../../../features/reveal-results'

interface ActiveItemPanelProps {
  item: Item
  unit: EstimationUnit
  isFirst: boolean
  isLast: boolean
  onFinalize: (id: string, best: number, likely: number, worst: number) => FinalizeResult
  onAdvance: () => void
  onNavigatePrev: () => void
  onNotesChange: (id: string, notes: string) => void
  onDescriptionChange: (id: string, description: string) => void
  onTitleChange: (id: string, title: string) => void
}

function ActiveItemPanel({
  item,
  unit,
  isFirst,
  isLast,
  onFinalize,
  onAdvance,
  onNavigatePrev,
  onNotesChange,
  onDescriptionChange,
  onTitleChange,
}: ActiveItemPanelProps) {
  const isEdit = item.finalResult !== null
  const [best, setBest] = useState(item.finalResult ? String(item.finalResult.min) : '')
  const [likely, setLikely] = useState(
    item.finalResult ? String(item.finalResult.expected) : '',
  )
  const [worst, setWorst] = useState(item.finalResult ? String(item.finalResult.max) : '')
  const {
    openKey: infoOpen,
    open: openInfo,
    close: closeInfo,
  } = useSingleInfoPopover<'description' | 'estimate' | 'phase' | 'range'>()

  const allFilled = best !== '' && likely !== '' && worst !== ''
  const bestNum = Number(best)
  const likelyNum = Number(likely)
  const worstNum = Number(worst)

  const validation = allFilled
    ? createEstimate({
        participantId: 'facilitator',
        best: bestNum,
        likely: likelyNum,
        worst: worstNum,
      })
    : null
  const validationError = validation && !validation.ok ? validation.error : null

  const symmetricGuard = allFilled
    ? checkSymmetricRange(bestNum, likelyNum, worstNum)
    : null

  const { phaseIndex, setPhaseIndex, guidanceHigh, uncertaintyGuard } = usePhaseGuidance(
    bestNum,
    worstNum,
    allFilled,
  )

  function handleFinalize() {
    const result = onFinalize(item.id, bestNum, likelyNum, worstNum)
    if (result.ok) onAdvance()
  }

  const primaryLabel = isEdit
    ? isLast
      ? 'Update & view summary'
      : 'Update & next →'
    : isLast
      ? 'Finalize & view summary'
      : 'Finalize & next →'

  return (
    <ItemDetailShell
      item={item}
      onNotesChange={onNotesChange}
      onDescriptionChange={onDescriptionChange}
      onTitleChange={onTitleChange}
      descriptionInfoOpen={infoOpen === 'description'}
      onDescriptionInfoOpen={() => openInfo('description')}
      onDescriptionInfoClose={closeInfo}
    >
      <GroupBox
        label="Phase"
        info={PHASE_INFO}
        infoOpen={infoOpen === 'phase'}
        onInfoOpen={() => openInfo('phase')}
        onInfoClose={closeInfo}
      >
        <PhasePicker index={phaseIndex} onChange={setPhaseIndex} />
      </GroupBox>

      <ThreePointEstimateFields
        unit={unit}
        best={best}
        likely={likely}
        worst={worst}
        onBestChange={setBest}
        onLikelyChange={setLikely}
        onWorstChange={setWorst}
        validationError={validationError}
        infoOpen={infoOpen === 'estimate'}
        onInfoOpen={() => openInfo('estimate')}
        onInfoClose={closeInfo}
      />

      <GroupBox
        label="Range"
        info={RANGE_INFO}
        infoOpen={infoOpen === 'range'}
        onInfoOpen={() => openInfo('range')}
        onInfoClose={closeInfo}
      >
        {validation?.ok ? (
          <>
            <RangeBar
              min={bestNum}
              max={worstNum}
              expected={likelyNum}
              ci90={computeCI90(likelyNum, bestNum, worstNum)}
              unitSuffix={UNIT_SUFFIX[unit]}
              guidance={guidanceHigh !== null ? { guidanceHigh } : undefined}
            />
            <UncertaintyGuidanceNotes
              guidanceHigh={guidanceHigh}
              worst={worstNum}
              unitSuffix={UNIT_SUFFIX[unit]}
              uncertaintyGuard={uncertaintyGuard}
            />
          </>
        ) : (
          <p className="text-muted" style={{ margin: 0, fontSize: 13 }}>
            Enter best, most likely and worst case above to see the range.
          </p>
        )}
      </GroupBox>

      {symmetricGuard?.fired && (
        <GuardNote variant="banner" headline="Symmetric range">
          Worst case in software usually has more room than best case. Double check.
        </GuardNote>
      )}
      {validationError && (
        <GuardNote variant="banner" headline="Invalid range">
          {validationError}
        </GuardNote>
      )}

      <NavRow isFirst={isFirst} onNavigatePrev={onNavigatePrev}>
        <Button
          variant="primary"
          style={{ flex: 1 }}
          disabled={!validation?.ok}
          onClick={handleFinalize}
        >
          {validation?.ok ? primaryLabel : isEdit ? 'Update item' : 'Finalize item'}
        </Button>
      </NavRow>
    </ItemDetailShell>
  )
}

export function Workspace() {
  const sessionName = useSessionStore((s) => s.sessionName)
  const unit = useSessionStore((s) => s.unit)
  const items = useSessionStore((s) => s.items)
  const activeItemId = useSessionStore((s) => s.activeItemId)
  const location = useLocation()
  const navigate = useNavigate()
  const mode = useSessionStore((s) => s.mode)
  const role = useSessionStore((s) => s.role)
  const sessionId = useSessionStore((s) => s.sessionId)
  const connectionStatus = useSessionStore((s) => s.connectionStatus)
  const peerCount = useSessionStore((s) => s.peerCount)
  const hasEverConnected = useSessionStore((s) => s.hasEverConnected)
  const participantNames = useSessionStore((s) => s.participantNames)
  const setSessionName = useSessionStore((s) => s.setSessionName)
  const setUnit = useSessionStore((s) => s.setUnit)
  const addItem = useSessionStore((s) => s.addItem)
  const updateItem = useSessionStore((s) => s.updateItem)
  const removeItem = useSessionStore((s) => s.removeItem)
  const selectItem = useSessionStore((s) => s.selectItem)
  const reorderItems = useSessionStore((s) => s.reorderItems)
  const setItemNotes = useSessionStore((s) => s.setItemNotes)
  const setItemDescription = useSessionStore((s) => s.setItemDescription)
  const finalizeItem = useSessionStore((s) => s.finalizeItem)
  const finalizeLiveItem = useSessionStore((s) => s.finalizeLiveItem)
  const revealRound = useSessionStore((s) => s.revealRound)
  const retryRound = useSessionStore((s) => s.retryRound)
  const { connect } = useNetworkSession()

  const isLiveFacilitator = mode === 'live' && role === 'facilitator'

  // Reveal/Retry are local store mutations only — the store subscription in
  // NetworkProvider broadcasts the resulting snapshot (revealed/round changed)
  // to participants, so there's no separate wire event to send here.
  function handleReveal(id: string) {
    revealRound(id)
  }

  function handleRetry(id: string) {
    retryRound(id)
  }

  const activeIndex = items.findIndex((item) => item.id === activeItemId)
  const activeItem = activeIndex === -1 ? null : items[activeIndex]!
  const isFirst = activeIndex <= 0
  const isLast = activeIndex === items.length - 1
  const allFinalized =
    items.length > 0 && items.every((item) => item.finalResult !== null)

  // Both the "←" control and the primary button's advance side effect move to
  // whichever item is adjacent in the sidebar's list order — not the next
  // *pending* item. A first pass through a fresh backlog is unaffected (items
  // are pending in list order anyway); revisiting an already-finalized item
  // (via a direct click in the sidebar) and hitting "next" just moves to
  // whatever's adjacent, with no separate "skip finalized" logic needed.
  function handleNavigatePrev() {
    if (activeIndex <= 0) return
    selectItem(items[activeIndex - 1]!.id)
  }

  function handleAdvance() {
    if (activeIndex === -1) return
    if (activeIndex === items.length - 1) {
      // The item at activeIndex was just (re-)finalized by the caller — every
      // *other* item's finalResult already reflects its pre-click state, so
      // this check doesn't need a fresh read from the store.
      const allFinalizedNow = items.every(
        (item, idx) => idx === activeIndex || item.finalResult !== null,
      )
      if (allFinalizedNow) {
        // Nothing left to work on — clear the selection so returning to the
        // workspace (e.g. via Summary's "Back to item") shows the "all items
        // finalized" empty state instead of reopening this now-done item.
        selectItem(null)
      }
      navigate('/summary')
    } else {
      selectItem(items[activeIndex + 1]!.id)
    }
  }

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

        <div className="workspace-topbar">
          <Input
            aria-label="Session name"
            value={sessionName}
            onChange={(e) => setSessionName(e.target.value)}
            placeholder="Untitled session"
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 15,
              fontWeight: 500,
              border: 'none',
              background: 'transparent',
              padding: 0,
              height: 'auto',
              flex: 'none',
              width: 'auto',
              minWidth: 120,
            }}
          />
          <PencilSimpleIcon
            size={12}
            style={{ color: 'var(--color-neutral-500)', flex: 'none' }}
          />
          <span className="text-muted" style={{ fontSize: 12, flex: 'none' }}>
            ·
          </span>
          <Select
            aria-label="Estimation unit"
            value={unit}
            onChange={(e) => setUnit(e.target.value as EstimationUnit)}
            style={{
              height: 22,
              fontSize: 12,
              padding: '0 4px',
              width: 'auto',
              flex: 'none',
            }}
          >
            <option value="hours">Hours</option>
            <option value="days">Days</option>
            <option value="weeks">Weeks</option>
          </Select>
          <span style={{ flex: 1 }} />
          <Button variant="ghost" onClick={() => navigate('/summary')}>
            <NotebookIcon size={15} />
            Summary
          </Button>
        </div>

        <div className="workspace-body">
          <div className="workspace-sidebar-col">
            <SessionSidebar
              items={items}
              activeItemId={activeItemId}
              isSummaryScreen={location.pathname === '/summary'}
              onSelect={selectItem}
              onReorder={reorderItems}
              onRemove={removeItem}
              onAdd={addItem}
              onGoSummary={() => navigate('/summary')}
              hideSummaryButton
            />
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
                  participantNames={participantNames}
                  onReveal={handleReveal}
                  onRetry={handleRetry}
                  onFinalize={finalizeLiveItem}
                  onAdvance={handleAdvance}
                  onNavigatePrev={handleNavigatePrev}
                  onNotesChange={setItemNotes}
                  onDescriptionChange={setItemDescription}
                  onTitleChange={(id, title) =>
                    updateItem(id, { title, description: activeItem.description })
                  }
                />
              ) : (
                <ActiveItemPanel
                  key={activeItem.id}
                  item={activeItem}
                  unit={unit}
                  isFirst={isFirst}
                  isLast={isLast}
                  onFinalize={finalizeItem}
                  onAdvance={handleAdvance}
                  onNavigatePrev={handleNavigatePrev}
                  onNotesChange={setItemNotes}
                  onDescriptionChange={setItemDescription}
                  onTitleChange={(id, title) =>
                    updateItem(id, { title, description: activeItem.description })
                  }
                />
              )
            ) : (
              <div className="workspace-empty-col">
                <ListChecksIcon size={28} style={{ color: 'var(--color-neutral-500)' }} />
                <CardTitle style={{ marginTop: 'var(--space-2)' }}>
                  {items.length === 0
                    ? 'Add an item to get started'
                    : allFinalized
                      ? 'All items finalized'
                      : 'Select an item to estimate'}
                </CardTitle>
                <CardBody style={{ maxWidth: 320 }}>
                  {items.length === 0
                    ? "Everything you're estimating lives in the list on the left. Add one, then select it here to record a best / likely / worst range."
                    : allFinalized
                      ? 'Every item has a recorded range — open the summary from the sidebar, or add another item.'
                      : 'Pick an item from the list on the left to record its best / likely / worst range.'}
                </CardBody>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  )
}
