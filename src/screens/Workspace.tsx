import { useState, type ReactNode } from 'react'
import { CopyIcon } from '@phosphor-icons/react/dist/csr/Copy'
import { PencilSimpleIcon } from '@phosphor-icons/react/dist/csr/PencilSimple'
import { ListChecksIcon } from '@phosphor-icons/react/dist/csr/ListChecks'
import {
  Button,
  Card,
  CardTitle,
  CardBody,
  Field,
  FieldLabel,
  Input,
  Select,
  Textarea,
  GuardNote,
  RangeBar,
  Tag,
} from '../components'
import { SessionSidebar } from './SessionSidebar'
import { useSessionStore, type FinalizeResult } from '../state/store'
import { useNetworkSession } from '../network'
import {
  aggregateEstimates,
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

interface EditableTitleProps {
  value: string
  onCommit: (next: string) => void
}

function EditableTitle({ value, onCommit }: EditableTitleProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  function commit() {
    setEditing(false)
    const trimmed = draft.trim()
    if (trimmed.length > 0 && trimmed !== value) {
      onCommit(trimmed)
    } else {
      setDraft(value)
    }
  }

  if (editing) {
    return (
      <Input
        autoFocus
        aria-label="Item title"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') {
            setDraft(value)
            setEditing(false)
          }
        }}
        style={{
          fontWeight: 500,
          fontSize: 22,
          textAlign: 'center',
          borderRadius: 'var(--radius-lg)',
        }}
      />
    )
  }

  return (
    <h1
      onClick={() => {
        setDraft(value)
        setEditing(true)
      }}
      title="Click to rename"
      style={{
        margin: 0,
        fontWeight: 500,
        fontSize: 22,
        textAlign: 'center',
        cursor: 'text',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-2)',
      }}
    >
      {value}
      <PencilSimpleIcon
        size={13}
        style={{ color: 'var(--color-neutral-500)', flex: 'none' }}
      />
    </h1>
  )
}

interface ItemDetailShellProps {
  item: Item
  onNotesChange: (id: string, notes: string) => void
  onDescriptionChange: (id: string, description: string) => void
  onTitleChange: (id: string, title: string) => void
  children: ReactNode
}

/** The chrome shared by every active-item panel: the elevated card, the
 *  click-to-edit title, the description field, and the discussion-notes field.
 *  `children` is the mode-specific middle (manual inputs, or the facilitator
 *  reveal flow). */
function ItemDetailShell({
  item,
  onNotesChange,
  onDescriptionChange,
  onTitleChange,
  children,
}: ItemDetailShellProps) {
  return (
    <Card elevation="sm" style={{ flex: 1 }}>
      <EditableTitle
        value={item.title}
        onCommit={(next) => onTitleChange(item.id, next)}
      />
      <Field>
        <FieldLabel htmlFor="description">Description (Markdown supported)</FieldLabel>
        <Textarea
          id="description"
          rows={3}
          value={item.description}
          onChange={(e) => onDescriptionChange(item.id, e.target.value)}
        />
      </Field>

      {children}

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

interface ActiveItemPanelProps {
  item: Item
  unit: EstimationUnit
  onFinalize: (id: string, best: number, likely: number, worst: number) => FinalizeResult
  onNotesChange: (id: string, notes: string) => void
  onDescriptionChange: (id: string, description: string) => void
  onTitleChange: (id: string, title: string) => void
}

function ActiveItemPanel({
  item,
  unit,
  onFinalize,
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
    <ItemDetailShell
      item={item}
      onNotesChange={onNotesChange}
      onDescriptionChange={onDescriptionChange}
      onTitleChange={onTitleChange}
    >
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
    </ItemDetailShell>
  )
}

interface FacilitatorRosterRow {
  id: string
  label: string
  submission: { best: number; likely: number; worst: number } | null
}

/** The people the facilitator is waiting on: every announced non-facilitator
 *  client, plus anyone whose submission arrived before their announce did.
 *  Announced names win; the rest get a stable "Teammate N". */
function buildRoster(
  item: Item,
  participantNames: Record<string, string>,
): FacilitatorRosterRow[] {
  const submissionById = new Map(item.submissions.map((s) => [s.participantId, s]))
  const ids = [
    ...Object.keys(participantNames).filter((id) => id !== 'facilitator'),
    ...item.submissions.map((s) => s.participantId),
  ]
  const seen = new Set<string>()
  let teammateNo = 0
  const rows: FacilitatorRosterRow[] = []
  for (const id of ids) {
    if (seen.has(id)) continue
    seen.add(id)
    const named = Object.hasOwn(participantNames, id) ? participantNames[id] : undefined
    const submission = submissionById.get(id)
    rows.push({
      id,
      label: named ?? `Teammate ${++teammateNo}`,
      submission: submission
        ? {
            best: submission.best,
            likely: submission.likely,
            worst: submission.worst,
          }
        : null,
    })
  }
  return rows
}

interface LiveFacilitatorPanelProps {
  item: Item
  unit: EstimationUnit
  participantNames: Record<string, string>
  onReveal: (id: string) => void
  onRetry: (id: string) => void
  onFinalize: (id: string) => FinalizeResult
  onNotesChange: (id: string, notes: string) => void
  onDescriptionChange: (id: string, description: string) => void
  onTitleChange: (id: string, title: string) => void
}

/** Live mode, facilitator side: Workspace states 1c (waiting for estimates) and
 *  1d (revealed). The facilitator never types estimate values — the range comes
 *  from aggregating participants' submissions. */
function LiveFacilitatorPanel({
  item,
  unit,
  participantNames,
  onReveal,
  onRetry,
  onFinalize,
  onNotesChange,
  onDescriptionChange,
  onTitleChange,
}: LiveFacilitatorPanelProps) {
  const suffix = UNIT_SUFFIX[unit]
  const roster = buildRoster(item, participantNames)
  const submittedCount = item.submissions.length
  const aggregate =
    item.revealed && submittedCount > 0 ? aggregateEstimates(item.submissions) : null

  return (
    <ItemDetailShell
      item={item}
      onNotesChange={onNotesChange}
      onDescriptionChange={onDescriptionChange}
      onTitleChange={onTitleChange}
    >
      {item.revealed && aggregate && (
        <RangeBar
          min={aggregate.min}
          max={aggregate.max}
          expected={aggregate.expected}
          ci90={aggregate.ci90}
          unitSuffix={suffix}
        />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <FieldLabel>
          {item.revealed ? 'Participant estimates' : 'Participants'}
        </FieldLabel>
        {roster.length === 0 ? (
          <p className="text-muted" style={{ margin: 0, fontSize: 13 }}>
            No participants have joined yet.
          </p>
        ) : (
          <ul
            style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}
          >
            {roster.map((row) => (
              <li
                key={row.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 'var(--space-3)',
                }}
              >
                <span>{row.label}</span>
                {item.revealed ? (
                  <span className={row.submission ? undefined : 'text-muted'}>
                    {row.submission
                      ? `${row.submission.best}${suffix} / ${row.submission.likely}${suffix} / ${row.submission.worst}${suffix}`
                      : 'No response'}
                  </span>
                ) : (
                  <Tag variant={row.submission ? 'accent' : 'neutral'}>
                    {row.submission ? 'Submitted' : 'Waiting'}
                  </Tag>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {item.revealed ? (
        item.finalResult !== null ? (
          <>
            <GuardNote variant="banner" headline="Already finalized">
              This item has a recorded range. Finalize again to refresh it from the
              current submissions.
            </GuardNote>
            <Button
              variant="primary"
              disabled={submittedCount === 0}
              onClick={() => onFinalize(item.id)}
            >
              Finalize item
            </Button>
          </>
        ) : (
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <Button
              variant="primary"
              style={{ flex: 1 }}
              disabled={submittedCount === 0}
              onClick={() => onFinalize(item.id)}
            >
              Finalize item
            </Button>
            <Button
              variant="secondary"
              style={{ flex: 1 }}
              onClick={() => onRetry(item.id)}
            >
              Retry — start new round
            </Button>
          </div>
        )
      ) : (
        <Button
          variant="primary"
          disabled={submittedCount === 0}
          onClick={() => onReveal(item.id)}
        >
          {submittedCount === 0
            ? 'Reveal estimates'
            : `Reveal estimates (${submittedCount} submitted)`}
        </Button>
      )}
    </ItemDetailShell>
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

export function Workspace() {
  const sessionName = useSessionStore((s) => s.sessionName)
  const unit = useSessionStore((s) => s.unit)
  const items = useSessionStore((s) => s.items)
  const activeItemId = useSessionStore((s) => s.activeItemId)
  const currentScreen = useSessionStore((s) => s.currentScreen)
  const mode = useSessionStore((s) => s.mode)
  const role = useSessionStore((s) => s.role)
  const sessionId = useSessionStore((s) => s.sessionId)
  const connectionStatus = useSessionStore((s) => s.connectionStatus)
  const peerCount = useSessionStore((s) => s.peerCount)
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
  const goToScreen = useSessionStore((s) => s.goToScreen)
  const { sendReveal, sendRoundReset } = useNetworkSession()

  const isLiveFacilitator = mode === 'live' && role === 'facilitator'

  function handleReveal(id: string) {
    revealRound(id)
    sendReveal(id)
  }

  function handleRetry(id: string) {
    retryRound(id)
    sendRoundReset(id)
  }

  const activeItem = items.find((item) => item.id === activeItemId) ?? null
  const allFinalized =
    items.length > 0 && items.every((item) => item.finalResult !== null)

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '300px 1fr',
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
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
              }}
            />
            <PencilSimpleIcon
              size={13}
              style={{ color: 'var(--color-neutral-500)', flex: 'none' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="text-muted" style={{ fontSize: 12 }}>
              Estimate in
            </span>
            <Select
              aria-label="Estimation unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value as EstimationUnit)}
              style={{ height: 24, fontSize: 12, padding: '0 4px', width: 'auto' }}
            >
              <option value="hours">Hours</option>
              <option value="days">Days</option>
              <option value="weeks">Weeks</option>
            </Select>
          </div>
        </div>

        <SessionSidebar
          items={items}
          activeItemId={activeItemId}
          currentScreen={currentScreen}
          onSelect={selectItem}
          onReorder={reorderItems}
          onRemove={removeItem}
          onAdd={addItem}
          onGoSummary={() => goToScreen('summary')}
        />
      </div>

      {activeItem ? (
        isLiveFacilitator ? (
          <LiveFacilitatorPanel
            key={activeItem.id}
            item={activeItem}
            unit={unit}
            participantNames={participantNames}
            onReveal={handleReveal}
            onRetry={handleRetry}
            onFinalize={finalizeLiveItem}
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
            onFinalize={finalizeItem}
            onNotesChange={setItemNotes}
            onDescriptionChange={setItemDescription}
            onTitleChange={(id, title) =>
              updateItem(id, { title, description: activeItem.description })
            }
          />
        )
      ) : (
        <Card
          elevation="sm"
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            gap: 'var(--space-2)',
          }}
        >
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
        </Card>
      )}
    </div>
  )
}
