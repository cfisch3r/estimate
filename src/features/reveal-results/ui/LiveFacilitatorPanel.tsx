import { useEffect, useRef } from 'react'
import { GroupBox, LiveRegion, Tag, VisuallyHidden } from '../../../shared/ui'
import { PARTICIPANT_ESTIMATES_INFO } from '../../../shared/copy'
import { useSingleInfoPopover } from '../../../shared/lib/useSingleInfoPopover'
import { EstimateTriple } from '../../../entities/estimate'
import type { EstimationUnit } from '../../../domain/estimate'
import { isFinalized } from '../../../domain/item'
import { ItemDetailShell } from '../../../entities/item'
import type { Item } from '../../../domain/types'
import { useRevealRound } from '../model/useRevealRound'
import { AggregatedRange } from './AggregatedRange'
import { FinalizedFooter, PreRevealFooter, ReviewFooter } from './RevealFooters'

interface LiveFacilitatorPanelProps {
  item: Item
  unit: EstimationUnit
  isFirst: boolean
  isLast: boolean
  onAdvance: () => void
  onNavigatePrev: () => void
}

/** Live mode, facilitator side: Workspace states 1c (waiting for estimates) and
 *  1d (revealed). The facilitator never types estimate values — the range comes
 *  from aggregating participants' submissions. */
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
            {item.revealed || roster.length === 0
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

      {item.revealed && (
        <AggregatedRange
          submissions={item.submissions}
          unit={unit}
          infoOpen={infoOpen === 'range'}
          onInfoOpen={() => openInfo('range')}
          onInfoClose={closeInfo}
        />
      )}

      {!item.revealed ? (
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
