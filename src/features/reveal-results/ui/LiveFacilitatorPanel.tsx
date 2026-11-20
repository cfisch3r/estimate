import { useEffect, useRef } from 'react'
import { GroupBox, LiveRegion, Tag, VisuallyHidden } from '../../../shared/ui'
import { PARTICIPANT_ESTIMATES_INFO } from '../../../shared/copy'
import { useSingleInfoPopover } from '../../../shared/lib/useSingleInfoPopover'
import { EstimateTriple } from '../../../entities/estimate'
import { AggregatedRange } from './AggregatedRange'
import { aggregateEstimates, type EstimationUnit } from '../../../domain/estimate'
import { isFinalized, livePhaseOf } from '../../../domain/item'
import { ItemDetailShell } from '../../../entities/item'
import type { Item } from '../../../domain/types'
import { useRevealRound } from '../model/useRevealRound'
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
  const live = livePhaseOf(item)
  // No round is open on an item finalized earlier, so nobody is "waiting" and
  // there is no submitted count to announce.
  const roundOpen = live.phase === 'open'
  const range =
    live.phase === 'finalizedEarlier'
      ? { kind: 'finalized' as const, values: live.finalResult }
      : live.phase === 'revealed' && submittedCount > 0
        ? { kind: 'aggregated' as const, values: aggregateEstimates(item.submissions) }
        : null
  const {
    openKey: infoOpen,
    open: openInfo,
    close: closeInfo,
  } = useSingleInfoPopover<'description' | 'estimate' | 'range'>()

  // Reopen / Retry unmount the footer button that had focus (the footer swaps
  // for the pre-reveal one, whose Reveal button is disabled with no
  // submissions), which would drop focus to <body>. Hand it to the participants
  // group's label, which is on screen in every state. Both start a new round,
  // so a bumped round on the same item is the signal — which also covers
  // reopening an item finalized in an earlier session, never revealed here.
  const participantsRef = useRef<HTMLSpanElement>(null)
  const previous = useRef({ itemId: item.id, round: item.round })
  useEffect(() => {
    const was = previous.current
    previous.current = { itemId: item.id, round: item.round }
    if (was.itemId === item.id && was.round !== item.round) {
      participantsRef.current?.focus()
    }
  }, [item.id, item.round])

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
          kind={range.kind}
          range={range.values}
          unit={unit}
          infoOpen={infoOpen === 'range'}
          onInfoOpen={() => openInfo('range')}
          onInfoClose={closeInfo}
        />
      )}

      {live.phase === 'finalizedEarlier' ? (
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
