import { useEffect, useRef, useState, type ReactNode } from 'react'
import { CopyIcon } from '@phosphor-icons/react/dist/csr/Copy'
import { PencilSimpleIcon } from '@phosphor-icons/react/dist/csr/PencilSimple'
import { NotebookIcon } from '@phosphor-icons/react/dist/csr/Notebook'
import { CaretLeftIcon } from '@phosphor-icons/react/dist/csr/CaretLeft'
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
  GroupBox,
  RangeBar,
  PhasePicker,
  UncertaintyGuidanceNotes,
  ThreePointEstimateFields,
  Tag,
  Markdown,
  MarkdownToolbar,
} from '../components'
import { continueListOnEnter, indentListLine } from '../components/markdownListEditing'
import {
  DESCRIPTION_INFO,
  PHASE_INFO,
  RANGE_INFO,
  PARTICIPANT_ESTIMATES_INFO,
} from '../copy/groupInfo'
import { SessionSidebar } from './SessionSidebar'
import { useConfirmArm } from '../hooks/useConfirmArm'
import { usePhaseGuidance } from '../hooks/usePhaseGuidance'
import { useSingleInfoPopover } from '../hooks/useSingleInfoPopover'
import { useSessionStore, type FinalizeResult } from '../state/store'
import { useNetworkSession } from '../network'
import {
  aggregateEstimates,
  checkSymmetricRange,
  computeCI90,
  createEstimate,
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

interface DescriptionFieldProps {
  value: string
  onChange: (next: string) => void
  infoOpen: boolean
  onInfoOpen: () => void
  onInfoClose: () => void
}

/** The description field's write/preview toggle. Preview renders through the
 *  same `Markdown` component the participant view uses, so what the
 *  facilitator sees here is exactly what participants will see — no separate
 *  rendering path to drift out of sync. A `GroupBox` like Phase/Range/etc.
 *  rather than a plain `Field`, so it reads as one of the item's sections
 *  instead of sitting apart from them. */
function DescriptionField({
  value,
  onChange,
  infoOpen,
  onInfoOpen,
  onInfoClose,
}: DescriptionFieldProps) {
  const [mode, setMode] = useState<'write' | 'preview'>('write')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Grows the textarea to fit its content (up to the CSS max-height, past
  // which it scrolls) rather than a fixed row count — re-measuring on every
  // value change, and whenever the field becomes visible again after a
  // Preview round-trip, so switching back to Write always shows the full
  // text sized correctly rather than the write-mode default.
  useEffect(() => {
    const textarea = textareaRef.current
    if (mode !== 'write' || !textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${textarea.scrollHeight}px`
  }, [value, mode])

  return (
    <GroupBox
      label="Description"
      info={DESCRIPTION_INFO}
      infoOpen={infoOpen}
      onInfoOpen={onInfoOpen}
      onInfoClose={onInfoClose}
    >
      <div className="md-tabs">
        <button
          type="button"
          className={['md-tab', mode === 'write' && 'md-tab--active'].filter(Boolean).join(' ')}
          onClick={() => setMode('write')}
        >
          Write
        </button>
        <button
          type="button"
          className={['md-tab', mode === 'preview' && 'md-tab--active']
            .filter(Boolean)
            .join(' ')}
          onClick={() => setMode('preview')}
        >
          Preview
        </button>
      </div>
      <div className="md-panel">
        {mode === 'write' ? (
          <>
            <MarkdownToolbar textareaRef={textareaRef} value={value} onChange={onChange} />
            <Textarea
              aria-label="Description"
              ref={textareaRef}
              className="textarea-autosize"
              rows={3}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => {
                const textarea = e.currentTarget
                if (e.key === 'Enter') {
                  const next = continueListOnEnter(textarea, value)
                  if (next !== null) {
                    e.preventDefault()
                    onChange(next)
                  }
                } else if (e.key === 'Tab') {
                  const next = indentListLine(textarea, value, e.shiftKey)
                  if (next !== null) {
                    e.preventDefault()
                    onChange(next)
                  }
                }
              }}
            />
          </>
        ) : value ? (
          <Markdown content={value} className="markdown-preview" />
        ) : (
          <p className="text-muted" style={{ margin: 0, fontSize: 13 }}>
            Nothing to preview yet.
          </p>
        )}
      </div>
    </GroupBox>
  )
}

interface ItemDetailShellProps {
  item: Item
  onNotesChange: (id: string, notes: string) => void
  onDescriptionChange: (id: string, description: string) => void
  onTitleChange: (id: string, title: string) => void
  descriptionInfoOpen: boolean
  onDescriptionInfoOpen: () => void
  onDescriptionInfoClose: () => void
  children: ReactNode
}

/** The chrome shared by every active-item panel: the click-to-edit title, the
 *  description field, and the discussion-notes field. `children` is the
 *  mode-specific middle (manual inputs, or the facilitator reveal flow). Sits
 *  flush inside Workspace's merged card — no card/shadow of its own. */
function ItemDetailShell({
  item,
  onNotesChange,
  onDescriptionChange,
  onTitleChange,
  descriptionInfoOpen,
  onDescriptionInfoOpen,
  onDescriptionInfoClose,
  children,
}: ItemDetailShellProps) {
  return (
    <>
      <EditableTitle
        value={item.title}
        onCommit={(next) => onTitleChange(item.id, next)}
      />
      <DescriptionField
        value={item.description}
        onChange={(next) => onDescriptionChange(item.id, next)}
        infoOpen={descriptionInfoOpen}
        onInfoOpen={onDescriptionInfoOpen}
        onInfoClose={onDescriptionInfoClose}
      />

      {children}

      <Field style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <FieldLabel htmlFor="notes">Notes (captured during discussion)</FieldLabel>
        <Textarea
          id="notes"
          rows={8}
          value={item.notes}
          onChange={(e) => onNotesChange(item.id, e.target.value)}
          style={{ flex: 1, minHeight: 0, resize: 'vertical' }}
        />
      </Field>
    </>
  )
}

interface NavRowProps {
  isFirst: boolean
  onNavigatePrev: () => void
  children: ReactNode
}

/** The "← + primary advance action" row shared by both facilitator-side
 *  panels: ← only ever navigates to the adjacent item (never a finalize side
 *  effect), the primary button (passed as `children`) does the finalize/advance. */
function NavRow({ isFirst, onNavigatePrev, children }: NavRowProps) {
  return (
    <div className="workspace-navrow">
      <Button
        icon
        variant="secondary"
        aria-label="Previous item"
        disabled={isFirst}
        onClick={onNavigatePrev}
      >
        <CaretLeftIcon size={16} />
      </Button>
      {children}
    </div>
  )
}

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
  isFirst: boolean
  isLast: boolean
  participantNames: Record<string, string>
  onReveal: (id: string) => void
  onRetry: (id: string) => void
  onFinalize: (id: string) => FinalizeResult
  onAdvance: () => void
  onNavigatePrev: () => void
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
  isFirst,
  isLast,
  participantNames,
  onReveal,
  onRetry,
  onFinalize,
  onAdvance,
  onNavigatePrev,
  onNotesChange,
  onDescriptionChange,
  onTitleChange,
}: LiveFacilitatorPanelProps) {
  const suffix = UNIT_SUFFIX[unit]
  const roster = buildRoster(item, participantNames)
  const submittedCount = item.submissions.length
  const aggregate =
    item.revealed && submittedCount > 0 ? aggregateEstimates(item.submissions) : null
  const isFinalized = item.finalResult !== null
  const {
    openKey: infoOpen,
    open: openInfo,
    close: closeInfo,
  } = useSingleInfoPopover<'description' | 'estimate' | 'range'>()
  const {
    armed: reopenArmed,
    handleClick: armAndReopen,
    ref: reopenRef,
  } = useConfirmArm<HTMLButtonElement>(() => onRetry(item.id))

  function handleFinalizeAndAdvance() {
    const result = onFinalize(item.id)
    if (result.ok) onAdvance()
  }

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
        label={item.revealed ? 'Participant estimates' : 'Participants'}
        info={PARTICIPANT_ESTIMATES_INFO}
        infoOpen={infoOpen === 'estimate'}
        onInfoOpen={() => openInfo('estimate')}
        onInfoClose={closeInfo}
      >
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
      </GroupBox>

      {item.revealed && aggregate && (
        <GroupBox
          label="Range (aggregated)"
          info={RANGE_INFO}
          infoOpen={infoOpen === 'range'}
          onInfoOpen={() => openInfo('range')}
          onInfoClose={closeInfo}
        >
          <RangeBar
            min={aggregate.min}
            max={aggregate.max}
            expected={aggregate.expected}
            ci90={aggregate.ci90}
            unitSuffix={suffix}
          />
        </GroupBox>
      )}

      {!item.revealed ? (
        <Button
          variant="primary"
          disabled={submittedCount === 0}
          onClick={() => onReveal(item.id)}
        >
          {submittedCount === 0
            ? 'Reveal estimates'
            : `Reveal estimates (${submittedCount} submitted)`}
        </Button>
      ) : isFinalized ? (
        <>
          <p className="text-muted" style={{ margin: 0, fontSize: 13 }}>
            This item has a recorded range. Late submissions are ignored — to re-estimate,
            reopen the item.
          </p>
          <NavRow isFirst={isFirst} onNavigatePrev={onNavigatePrev}>
            <Button
              variant="primary"
              style={{ flex: 1 }}
              onClick={handleFinalizeAndAdvance}
            >
              {isLast ? 'Update & view summary' : 'Update & next →'}
            </Button>
            <Button
              ref={reopenRef}
              variant="ghost"
              style={{
                flex: 'none',
                color: reopenArmed ? 'var(--color-warning)' : undefined,
              }}
              onClick={armAndReopen}
            >
              {reopenArmed ? 'Click again to reopen' : 'Reopen item'}
            </Button>
          </NavRow>
        </>
      ) : (
        <NavRow isFirst={isFirst} onNavigatePrev={onNavigatePrev}>
          <Button
            variant="primary"
            style={{ flex: 1 }}
            disabled={submittedCount === 0}
            onClick={handleFinalizeAndAdvance}
          >
            {isLast ? 'Finalize & view summary' : 'Finalize & next →'}
          </Button>
          <Button
            variant="secondary"
            style={{ flex: 'none' }}
            onClick={() => onRetry(item.id)}
          >
            Retry round
          </Button>
        </NavRow>
      )}
    </ItemDetailShell>
  )
}

interface LiveSessionStripProps {
  sessionId: string
  connectionStatus: LiveConnectionStatus
  peerCount: number
  hasEverConnected: boolean
  onReconnect: () => void
}

function LiveSessionStrip({
  sessionId,
  connectionStatus,
  peerCount,
  hasEverConnected,
  onReconnect,
}: LiveSessionStripProps) {
  // Zero peers is NOT a connection loss for a facilitator: a participant closing
  // their tab at the end of a session is indistinguishable, at this layer, from a
  // link breaking. Only a join failure (`disconnected`, from onJoinError) is a
  // real fault. hasEverConnected (latched true once this room has had a peer,
  // never reset until a new session) is what lets "nobody has joined yet" read
  // differently from "everyone who was here has left".
  const statusTag =
    connectionStatus === 'connected'
      ? {
          variant: 'accent' as const,
          label: `${peerCount} participant${peerCount === 1 ? '' : 's'} connected`,
        }
      : connectionStatus === 'disconnected'
        ? { variant: 'outline' as const, label: 'Disconnected' }
        : hasEverConnected
          ? { variant: 'outline' as const, label: 'All participants disconnected' }
          : { variant: 'neutral' as const, label: 'Waiting for participants…' }

  return (
    <div className="workspace-strip">
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
      {connectionStatus === 'disconnected' && (
        <Button variant="ghost" onClick={onReconnect}>
          Reconnect
        </Button>
      )}
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
  const goToScreen = useSessionStore((s) => s.goToScreen)
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
      goToScreen('summary')
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
          <Button variant="ghost" onClick={() => goToScreen('summary')}>
            <NotebookIcon size={15} />
            Summary
          </Button>
        </div>

        <div className="workspace-body">
          <div className="workspace-sidebar-col">
            <SessionSidebar
              items={items}
              activeItemId={activeItemId}
              currentScreen={currentScreen}
              onSelect={selectItem}
              onReorder={reorderItems}
              onRemove={removeItem}
              onAdd={addItem}
              onGoSummary={() => goToScreen('summary')}
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
