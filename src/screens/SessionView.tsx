import { useState } from 'react'
import { PlayIcon } from '@phosphor-icons/react/dist/csr/Play'
import {
  Button,
  Card,
  CardTitle,
  CardBody,
  CardMeta,
  Field,
  FieldLabel,
  Input,
  Textarea,
  GuardNote,
  RangeBar,
} from '../components'
import { useSessionStore } from '../state/store'
import {
  checkSymmetricRange,
  checkFalsePrecision,
  computeCI90,
  createEstimate,
  UNIT_GRANULARITY,
  UNIT_SUFFIX,
} from '../calc'
import type { EstimationUnit } from '../calc'
import type { Item } from '../state/types'

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
      <CardTitle>{item.title}</CardTitle>
      <Field>
        <FieldLabel htmlFor="description">Description (Markdown supported)</FieldLabel>
        <Textarea
          id="description"
          rows={3}
          value={item.description}
          onChange={(e) => onDescriptionChange(item.id, e.target.value)}
        />
      </Field>

      <p className="estimate-prompt">
        Would you stake your job this won&apos;t be exceeded?
      </p>

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
        <GuardNote>
          Your range looks symmetric — worst case in software usually has more room than
          best case. Double check.
        </GuardNote>
      )}
      {validationError && <GuardNote>{validationError}</GuardNote>}

      <Button variant="primary" disabled={!validation?.ok} onClick={handleFinalize}>
        {isEdit ? 'Update estimate' : 'Finalize item'}
      </Button>

      <Field style={{ flex: 1 }}>
        <FieldLabel htmlFor="notes">
          Notes (captured during discussion, Markdown supported)
        </FieldLabel>
        <Textarea
          id="notes"
          rows={8}
          value={item.notes}
          onChange={(e) => onNotesChange(item.id, e.target.value)}
          style={{ height: '100%', resize: 'vertical' }}
        />
      </Field>
    </Card>
  )
}

export function SessionView() {
  const unit = useSessionStore((s) => s.unit)
  const items = useSessionStore((s) => s.items)
  const activeItemId = useSessionStore((s) => s.activeItemId)
  const selectItem = useSessionStore((s) => s.selectItem)
  const setItemNotes = useSessionStore((s) => s.setItemNotes)
  const setItemDescription = useSessionStore((s) => s.setItemDescription)
  const finalizeItem = useSessionStore((s) => s.finalizeItem)
  const goToScreen = useSessionStore((s) => s.goToScreen)

  const activeItem = items.find((item) => item.id === activeItemId) ?? null
  const allFinalized =
    items.length > 0 && items.every((item) => item.finalResult !== null)

  return (
    <div
      style={{ display: 'flex', gap: 16, maxWidth: 1200, margin: '0 auto', padding: 24 }}
    >
      <div style={{ width: 220, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <h2 className="sidebar-heading">Items</h2>
        {items.map((item) => (
          <Card
            key={item.id}
            elevation={item.id === activeItemId ? 'sm' : undefined}
            style={{
              cursor: 'pointer',
              borderLeft:
                item.id === activeItemId ? '2px solid var(--color-accent)' : undefined,
            }}
            onClick={() => selectItem(item.id)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {item.id === activeItemId && <PlayIcon size={12} />}
              <span>{item.title}</span>
            </div>
            {item.finalResult && <CardMeta>Finalized</CardMeta>}
          </Card>
        ))}
        <Button variant="ghost" onClick={() => goToScreen('summary')}>
          View summary
        </Button>
      </div>

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
