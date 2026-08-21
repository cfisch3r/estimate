import { useState } from 'react'
import { PlayIcon } from '@phosphor-icons/react/dist/csr/Play'
import {
  Button,
  Card,
  CardKicker,
  CardTitle,
  CardBody,
  CardMeta,
  Field,
  FieldLabel,
  Input,
  Textarea,
} from '../components'
import { useSessionStore } from '../state/store'
import { checkSymmetricRange, checkFalsePrecision, UNIT_GRANULARITY } from '../calc'
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
}

function ActiveItemPanel({
  item,
  unit,
  onFinalize,
  onNotesChange,
}: ActiveItemPanelProps) {
  const [best, setBest] = useState('')
  const [likely, setLikely] = useState('')
  const [worst, setWorst] = useState('')
  const [error, setError] = useState<string | null>(null)

  const allFilled = best !== '' && likely !== '' && worst !== ''
  const bestNum = Number(best)
  const likelyNum = Number(likely)
  const worstNum = Number(worst)
  const granularity = UNIT_GRANULARITY[unit]

  const symmetricGuard = allFilled
    ? checkSymmetricRange(bestNum, likelyNum, worstNum)
    : null
  const bestPrecision = best !== '' ? checkFalsePrecision(bestNum, granularity) : null
  const likelyPrecision =
    likely !== '' ? checkFalsePrecision(likelyNum, granularity) : null
  const worstPrecision = worst !== '' ? checkFalsePrecision(worstNum, granularity) : null

  function handleFinalize() {
    const result = onFinalize(item.id, bestNum, likelyNum, worstNum)
    setError(result.ok ? null : result.error)
  }

  return (
    <Card elevation="sm" style={{ flex: 1 }}>
      <CardTitle>{item.title}</CardTitle>
      {item.description && <CardBody>{item.description}</CardBody>}

      <Field>
        <FieldLabel htmlFor="notes">
          Notes (captured during discussion, Markdown supported)
        </FieldLabel>
        <Textarea
          id="notes"
          rows={8}
          value={item.notes}
          onChange={(e) => onNotesChange(item.id, e.target.value)}
        />
      </Field>

      <div style={{ display: 'flex', gap: 8 }}>
        <Field style={{ flex: 1 }}>
          <FieldLabel htmlFor="best">{`Best case (${unit})`}</FieldLabel>
          <Input
            id="best"
            type="number"
            value={best}
            onChange={(e) => setBest(e.target.value)}
          />
          {bestPrecision?.fired && (
            <CardMeta>Consider rounding to a meaningful value.</CardMeta>
          )}
        </Field>
        <Field style={{ flex: 1 }}>
          <FieldLabel htmlFor="likely">{`Most likely (${unit})`}</FieldLabel>
          <Input
            id="likely"
            type="number"
            value={likely}
            onChange={(e) => setLikely(e.target.value)}
          />
          {likelyPrecision?.fired && (
            <CardMeta>Consider rounding to a meaningful value.</CardMeta>
          )}
        </Field>
        <Field style={{ flex: 1 }}>
          <FieldLabel htmlFor="worst">{`Worst case (${unit})`}</FieldLabel>
          <Input
            id="worst"
            type="number"
            value={worst}
            onChange={(e) => setWorst(e.target.value)}
          />
          {worstPrecision?.fired && (
            <CardMeta>Consider rounding to a meaningful value.</CardMeta>
          )}
        </Field>
      </div>

      <CardMeta>Would you stake your job this won&apos;t be exceeded?</CardMeta>
      {symmetricGuard?.fired && (
        <CardMeta>
          Your range looks symmetric — worst case in software usually has more room than
          best case. Double check.
        </CardMeta>
      )}
      {error && <CardMeta>{error}</CardMeta>}

      <Button variant="primary" disabled={!allFilled} onClick={handleFinalize}>
        Finalize item
      </Button>
    </Card>
  )
}

export function SessionView() {
  const sessionName = useSessionStore((s) => s.sessionName)
  const unit = useSessionStore((s) => s.unit)
  const items = useSessionStore((s) => s.items)
  const activeItemId = useSessionStore((s) => s.activeItemId)
  const selectItem = useSessionStore((s) => s.selectItem)
  const setItemNotes = useSessionStore((s) => s.setItemNotes)
  const finalizeItem = useSessionStore((s) => s.finalizeItem)
  const goToScreen = useSessionStore((s) => s.goToScreen)

  const activeItem = items.find((item) => item.id === activeItemId) ?? null
  const allFinalized =
    items.length > 0 && items.every((item) => item.finalResult !== null)

  return (
    <div
      style={{ display: 'flex', gap: 16, maxWidth: 960, margin: '0 auto', padding: 24 }}
    >
      <div style={{ width: 220, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <CardKicker>{sessionName || 'Session View — Manual Entry'}</CardKicker>
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
