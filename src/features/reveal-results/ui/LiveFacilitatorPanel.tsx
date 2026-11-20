import { GroupBox, LiveRegion, Tag, VisuallyHidden } from '../../../shared/ui'
import { PARTICIPANT_ESTIMATES_INFO } from '../../../shared/copy'
import { useSingleInfoPopover } from '../../../shared/lib/useSingleInfoPopover'
import { EstimateTriple } from '../../../entities/estimate'
import { AggregatedRange } from './AggregatedRange'
import type { EstimationUnit } from '../../../domain/estimate'
import { ItemDetailShell } from '../../../entities/item'
import type { Item } from '../../../domain/types'
import { useFocusOnNewRound } from '../model/useFocusOnNewRound'
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
  const { roster, reveal, retry, finalizeAndAdvance, view } = useRevealRound(
    item,
    onAdvance,
  )
  const participantsRef = useFocusOnNewRound<HTMLSpanElement>(item)
  const {
    openKey: infoOpen,
    open: openInfo,
    close: closeInfo,
  } = useSingleInfoPopover<'description' | 'estimate' | 'range'>()

  return (
    <ItemDetailShell
      item={item}
      descriptionInfoOpen={infoOpen === 'description'}
      onDescriptionInfoOpen={() => openInfo('description')}
      onDescriptionInfoClose={closeInfo}
    >
      <GroupBox
        labelRef={participantsRef}
        label={view.revealed ? 'Participant estimates' : 'Participants'}
        info={PARTICIPANT_ESTIMATES_INFO}
        infoOpen={infoOpen === 'estimate'}
        onInfoOpen={() => openInfo('estimate')}
        onInfoClose={closeInfo}
      >
        <LiveRegion>
          <VisuallyHidden>
            {view.roundOpen && roster.length > 0
              ? `${view.submittedCount} of ${roster.length} submitted`
              : ''}
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
                {view.revealed ? (
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
                ) : view.roundOpen ? (
                  <Tag variant={row.submission ? 'accent' : 'neutral'}>
                    {row.submission ? 'Submitted' : 'Waiting'}
                  </Tag>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </GroupBox>

      {view.range && (
        <AggregatedRange
          kind={view.range.kind}
          range={view.range.values}
          unit={unit}
          infoOpen={infoOpen === 'range'}
          onInfoOpen={() => openInfo('range')}
          onInfoClose={closeInfo}
        />
      )}

      {view.footer === 'resumedFinalized' && (
        <ResumedFinalizedFooter
          isFirst={isFirst}
          isLast={isLast}
          onNavigatePrev={onNavigatePrev}
          onAdvance={onAdvance}
          onReopen={retry}
        />
      )}
      {view.footer === 'preReveal' && (
        <PreRevealFooter submittedCount={view.submittedCount} onReveal={reveal} />
      )}
      {view.footer === 'finalized' && (
        <FinalizedFooter
          isFirst={isFirst}
          isLast={isLast}
          onNavigatePrev={onNavigatePrev}
          onUpdate={finalizeAndAdvance}
          onReopen={retry}
        />
      )}
      {view.footer === 'review' && (
        <ReviewFooter
          submittedCount={view.submittedCount}
          isFirst={isFirst}
          isLast={isLast}
          onNavigatePrev={onNavigatePrev}
          onFinalize={finalizeAndAdvance}
          onRetry={retry}
        />
      )}
    </ItemDetailShell>
  )
}
