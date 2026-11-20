import { useEffect, useRef } from 'react'
import { GroupBox, LiveRegion, Tag, VisuallyHidden } from '../../../shared/ui'
import { PARTICIPANT_ESTIMATES_INFO } from '../../../shared/copy'
import { useSingleInfoPopover } from '../../../shared/lib/useSingleInfoPopover'
import { EstimateTriple } from '../../../entities/estimate'
import { aggregateEstimates, type EstimationUnit } from '../../../domain/estimate'
import { isFinalized } from '../../../domain/item'
import { ItemDetailShell } from '../../../entities/item'
import type { Item } from '../../../domain/types'
import { useRevealRound } from '../model/useRevealRound'
import { AggregatedRange } from './AggregatedRange'
import {
  FinalizedFooter,
  PreRevealFooter,
  ResumedFinalizedFooter,
  ReviewFooter,
} from './RevealFooters'

interface LiveFacilitatorPanelProps {
  item: Item
  unit: EstimationUnit
  isFirst: boolean
  isLast: boolean
  onAdvance: () => void
  onNavigatePrev: () => void
}

/** Live mode, facilitator side: Workspace states 1c (waiting for estimates) and
 *  1d (revealed), plus an item finalized before this session started (a loaded
 *  session file), which has a saved range but no round. The facilitator never
 *  types estimate values — the range comes from aggregating participants'
 *  submissions, or is the saved one. */
export function LiveFacilitatorPanel({
  item,
  unit,
  isFirst,
  isLast,
  onAdvance,
  onNavigatePrev,
}: LiveFacilitatorPanelProps) {
  const { roster, reveal, retry, finalize } = useRevealRound(item)
  const submittedCount = item.submissions.length
  // Finalized with no round revealed in this session: only a loaded session
  // file gets here, since finalizing live always follows a reveal.
  const resumedFinal = !item.revealed && isFinalized(item) ? item.finalResult : null
  // No round is open on a resumed finalized item, so nobody is "waiting" and
  // there is no submitted count to announce.
  const roundOpen = !item.revealed && !resumedFinal
  const range = item.revealed
    ? submittedCount > 0
      ? { label: 'Range (aggregated)', values: aggregateEstimates(item.submissions) }
      : null
    : resumedFinal && { label: 'Range (finalized)', values: resumedFinal }
  const {
    openKey: infoOpen,
    open: openInfo,
    close: closeInfo,
  } = useSingleInfoPopover<'description' | 'estimate' | 'range'>()

  // Reopen / Retry unmount the footer button that had focus (the footer swaps
  // for the pre-reveal one, whose Reveal button is disabled with no
  // submissions), which would drop focus to <body>. Hand it to the participants
  // group's label, which is on screen in every state.
  const participantsRef = useRef<HTMLSpanElement>(null)
  const previous = useRef({ itemId: item.id, revealed: item.revealed })
  useEffect(() => {
    const was = previous.current
    previous.current = { itemId: item.id, revealed: item.revealed }
    if (was.itemId === item.id && was.revealed && !item.revealed) {
      participantsRef.current?.focus()
    }
  }, [item.id, item.revealed])

  function handleFinalizeAndAdvance() {
    if (finalize().ok) onAdvance()
  }

  return (
    <ItemDetailShell
      item={item}
      descriptionInfoOpen={infoOpen === 'description'}
      onDescriptionInfoOpen={() => openInfo('description')}
      onDescriptionInfoClose={closeInfo}
    >
      <GroupBox
        labelRef={participantsRef}
        label={item.revealed ? 'Participant estimates' : 'Participants'}
        info={PARTICIPANT_ESTIMATES_INFO}
        infoOpen={infoOpen === 'estimate'}
        onInfoOpen={() => openInfo('estimate')}
        onInfoClose={closeInfo}
      >
        <LiveRegion>
          <VisuallyHidden>
            {!roundOpen || roster.length === 0
              ? ''
              : `${submittedCount} of ${roster.length} submitted`}
          </VisuallyHidden>
        </LiveRegion>
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
                    {row.submission ? (
                      <EstimateTriple
                        best={row.submission.best}
                        likely={row.submission.likely}
                        worst={row.submission.worst}
                        unit={unit}
                      />
                    ) : (
                      'No response'
                    )}
                  </span>
                ) : roundOpen ? (
                  <Tag variant={row.submission ? 'accent' : 'neutral'}>
                    {row.submission ? 'Submitted' : 'Waiting'}
                  </Tag>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </GroupBox>

      {range && (
        <AggregatedRange
          label={range.label}
          range={range.values}
          unit={unit}
          infoOpen={infoOpen === 'range'}
          onInfoOpen={() => openInfo('range')}
          onInfoClose={closeInfo}
        />
      )}

      {resumedFinal ? (
        <ResumedFinalizedFooter
          isFirst={isFirst}
          isLast={isLast}
          onNavigatePrev={onNavigatePrev}
          onAdvance={onAdvance}
          onReopen={retry}
        />
      ) : !item.revealed ? (
        <PreRevealFooter submittedCount={submittedCount} onReveal={reveal} />
      ) : isFinalized(item) ? (
        <FinalizedFooter
          isFirst={isFirst}
          isLast={isLast}
          onNavigatePrev={onNavigatePrev}
          onUpdate={handleFinalizeAndAdvance}
          onReopen={retry}
        />
      ) : (
        <ReviewFooter
          submittedCount={submittedCount}
          isFirst={isFirst}
          isLast={isLast}
          onNavigatePrev={onNavigatePrev}
          onFinalize={handleFinalizeAndAdvance}
          onRetry={retry}
        />
      )}
    </ItemDetailShell>
  )
}
