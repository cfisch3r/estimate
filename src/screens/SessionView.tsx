import { useState } from 'react'
import { CopyIcon } from '@phosphor-icons/react/dist/csr/Copy'
import {
  Button,
  Card,
  CardTitle,
  CardBody,
  Field,
  FieldLabel,
  Input,
  Textarea,
  GuardNote,
  RangeBar,
  Tag,
} from '../components'
import { SessionSidebar } from './SessionSidebar'
import { useSessionStore } from '../state/store'
import {
  checkAscendingOrder,
  checkSymmetricRange,
  checkFalsePrecision,
  computeCI90,
  createEstimate,
  UNIT_GRANULARITY,
  UNIT_SUFFIX,
} from '../calc'
import type { EstimationUnit } from '../calc'
import type { Item, LiveConnectionStatus } from '../state/types'

interface ActiveItemPanelProps {
  item: Item
  unit: EstimationUnit
  onFinalize: (
    id: string,
    best: number,
    likely: number,
    worst: number,
  ) => { ok: true } | { ok: false; error: string }
  onNotesChange: (id: string, notes: string) => void
  onDescriptionChange: (id: string, description: string) => void
}

function ActiveItemPanel({
  item,
  unit,
  onFinalize,
  onNotesChange,
  onDescriptionChange,
}: ActiveItemPanelProps) {
  const isEdit = item.finalResult !== null
  const [best, setBest] = useState(item.finalResult ? String(item.finalResult.min) : '')
  const [likely, setLikely] = useState(
    item.finalResult ? String(item.finalResult.expected) : '',
  )
  const [worst, setWorst] = useState(item.finalResult ? String(item.finalResult.max) : '')

  const allFilled = best !== '' && likely !== '' && worst !== ''
  const bestNum = Number(best)
  const likelyNum = Number(likely)
  const worstNum = Number(worst)
  const bestOrNull = best === '' ? null : bestNum
  const likelyOrNull = likely === '' ? null : likelyNum
  const worstOrNull = worst === '' ? null : worstNum
  const granularity = UNIT_GRANULARITY[unit]

  const validation = allFilled
    ? createEstimate({
        participantId: 'facilitator',
        best: bestNum,
        likely: likelyNum,
        worst: worstNum,
      })
    : null
  const validationError = validation && !validation.ok ? validation.error : null
  const ascendingGuard = checkAscendingOrder(bestOrNull, likelyOrNull, worstOrNull)
  const orderingWarning =
    !validationError && ascendingGuard.fired
      ? 'Values should ascend: best ≤ likely ≤ worst.'
      : null

  const symmetricGuard = allFilled
    ? checkSymmetricRange(bestNum, likelyNum, worstNum)
    : null
  const bestPrecision = best !== '' ? checkFalsePrecision(bestNum, granularity) : null
  const likelyPrecision =
    likely !== '' ? checkFalsePrecision(likelyNum, granularity) : null
  const worstPrecision = worst !== '' ? checkFalsePrecision(worstNum, granularity) : null

  function handleFinalize() {
    onFinalize(item.id, bestNum, likelyNum, worstNum)
  }

  return (
    <Card elevation="sm" style={{ flex: 1 }}>
      <h1 style={{ margin: 0, fontWeight: 500, fontSize: 22, textAlign: 'center' }}>
        {item.title}
      </h1>
      <Field>
        <FieldLabel htmlFor="description">Description (Markdown supported)</FieldLabel>
        <Textarea
          id="description"
          rows={3}
          value={item.description}
          onChange={(e) => onDescriptionChange(item.id, e.target.value)}
        />
      </Field>

      <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
        <Field style={{ flex: 1 }}>
          <FieldLabel htmlFor="best">{`Best case (${unit})`}</FieldLabel>
          <Input
            id="best"
            type="number"
            min={0}
            value={best}
            onChange={(e) => setBest(e.target.value)}
            style={{
              height: 48,
              fontSize: '1.1rem',
              textAlign: 'center',
              borderRadius: 'var(--radius-lg)',
            }}
          />
          {bestPrecision?.fired && (
            <GuardNote>Consider rounding to a meaningful value.</GuardNote>
          )}
        </Field>
        <Field style={{ flex: 1 }}>
          <FieldLabel htmlFor="likely">{`Most likely (${unit})`}</FieldLabel>
          <Input
            id="likely"
            type="number"
            min={0}
            value={likely}
            onChange={(e) => setLikely(e.target.value)}
            style={{
              height: 48,
              fontSize: '1.1rem',
              textAlign: 'center',
              borderRadius: 'var(--radius-lg)',
            }}
          />
          {likelyPrecision?.fired && (
            <GuardNote>Consider rounding to a meaningful value.</GuardNote>
          )}
        </Field>
        <Field style={{ flex: 1 }}>
          <FieldLabel htmlFor="worst">{`Worst case (${unit})`}</FieldLabel>
          <Input
            id="worst"
            type="number"
            min={0}
            value={worst}
            onChange={(e) => setWorst(e.target.value)}
            style={{
              height: 48,
              fontSize: '1.1rem',
              textAlign: 'center',
              borderRadius: 'var(--radius-lg)',
            }}
          />
          {worstPrecision?.fired && (
            <GuardNote>Consider rounding to a meaningful value.</GuardNote>
          )}
        </Field>
      </div>

      {allFilled && !Number.isNaN(bestNum + likelyNum + worstNum) && (
        <RangeBar
          min={bestNum}
          max={worstNum}
          expected={likelyNum}
          ci90={computeCI90(likelyNum, bestNum, worstNum)}
          unitSuffix={UNIT_SUFFIX[unit]}
        />
      )}

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
      {orderingWarning && (
        <GuardNote variant="banner" headline="Out of order">
          {orderingWarning}
        </GuardNote>
      )}

      <Button variant="primary" disabled={!validation?.ok} onClick={handleFinalize}>
        {isEdit ? 'Update estimate' : 'Finalize item'}
      </Button>

      <Field style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <FieldLabel htmlFor="notes">
          Notes (captured during discussion, Markdown supported)
        </FieldLabel>
        <Textarea
          id="notes"
          rows={8}
          value={item.notes}
          onChange={(e) => onNotesChange(item.id, e.target.value)}
          style={{ flex: 1, minHeight: 0, resize: 'vertical' }}
        />
      </Field>
    </Card>
  )
}

interface LiveSessionStripProps {
  sessionId: string
  connectionStatus: LiveConnectionStatus
  peerCount: number
}

function LiveSessionStrip({
  sessionId,
  connectionStatus,
  peerCount,
}: LiveSessionStripProps) {
  const statusTag =
    connectionStatus === 'connected'
      ? {
          variant: 'accent' as const,
          label: `${peerCount} participant${peerCount === 1 ? '' : 's'} connected`,
        }
      : connectionStatus === 'disconnected'
        ? { variant: 'outline' as const, label: 'Disconnected' }
        : { variant: 'neutral' as const, label: 'Waiting for participants…' }

  return (
    <div
      style={{
        gridColumn: '1 / -1',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-4)',
        padding: 'var(--space-3) var(--space-4)',
        border: '1px solid var(--color-divider)',
        borderRadius: 'var(--radius-lg)',
      }}
    >
      <span className="text-muted">Session code</span>
      <strong style={{ fontSize: '1.1rem', letterSpacing: '0.08em' }}>{sessionId}</strong>
      <Button
        icon
        variant="ghost"
        aria-label="Copy session code"
        onClick={() => {
          navigator.clipboard?.writeText(sessionId).catch(() => {})
        }}
      >
        <CopyIcon size={16} />
      </Button>
      <span style={{ flex: 1 }} />
      <Tag variant={statusTag.variant}>{statusTag.label}</Tag>
    </div>
  )
}

export function SessionView() {
  const unit = useSessionStore((s) => s.unit)
  const items = useSessionStore((s) => s.items)
  const activeItemId = useSessionStore((s) => s.activeItemId)
  const currentScreen = useSessionStore((s) => s.currentScreen)
  const mode = useSessionStore((s) => s.mode)
  const sessionId = useSessionStore((s) => s.sessionId)
  const connectionStatus = useSessionStore((s) => s.connectionStatus)
  const peerCount = useSessionStore((s) => s.peerCount)
  const selectItem = useSessionStore((s) => s.selectItem)
  const reorderItems = useSessionStore((s) => s.reorderItems)
  const setItemNotes = useSessionStore((s) => s.setItemNotes)
  const setItemDescription = useSessionStore((s) => s.setItemDescription)
  const finalizeItem = useSessionStore((s) => s.finalizeItem)
  const goToScreen = useSessionStore((s) => s.goToScreen)

  const activeItem = items.find((item) => item.id === activeItemId) ?? null
  const allFinalized =
    items.length > 0 && items.every((item) => item.finalResult !== null)

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
      {mode === 'live' && sessionId && (
        <LiveSessionStrip
          sessionId={sessionId}
          connectionStatus={connectionStatus}
          peerCount={peerCount}
        />
      )}

      <SessionSidebar
        items={items}
        activeItemId={activeItemId}
        currentScreen={currentScreen}
        onSelect={selectItem}
        onReorder={reorderItems}
        onGoSummary={() => goToScreen('summary')}
      />

      {activeItem ? (
        <ActiveItemPanel
          key={activeItem.id}
          item={activeItem}
          unit={unit}
          onFinalize={finalizeItem}
          onNotesChange={setItemNotes}
          onDescriptionChange={setItemDescription}
        />
      ) : (
        <Card elevation="sm" style={{ flex: 1 }}>
          <CardTitle>
            {allFinalized ? 'All items finalized' : 'No item selected'}
          </CardTitle>
          <CardBody>
            {allFinalized
              ? 'Every item in this session has a recorded range — view the summary from the sidebar.'
              : 'Select an item from the queue to estimate it.'}
          </CardBody>
        </Card>
      )}
    </div>
  )
}
