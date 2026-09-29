import { Button, GroupBox, Tag, NavRow } from '../../../shared/ui'
import { PARTICIPANT_ESTIMATES_INFO, RANGE_INFO } from '../../../shared/copy'
import { useConfirmArm } from '../../../shared/lib/useConfirmArm'
import { useSingleInfoPopover } from '../../../shared/lib/useSingleInfoPopover'
import {
  aggregateEstimates,
  UNIT_SUFFIX,
  RangeBar,
  type EstimationUnit,
} from '../../../entities/estimate'
import {
  ItemDetailShell,
  type Item,
  type FinalizeResult,
} from '../../../entities/session'
import { buildRoster } from '../lib/roster'

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
export function LiveFacilitatorPanel({
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
