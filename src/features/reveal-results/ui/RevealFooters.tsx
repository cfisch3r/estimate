import { Button, LiveRegion, NavRow, VisuallyHidden } from '../../../shared/ui'
import { useConfirmArm } from '../../../shared/lib/useConfirmArm'

interface PreRevealFooterProps {
  submittedCount: number
  onReveal: () => void
}

/** Footer while the round is open: the reveal action. */
export function PreRevealFooter({ submittedCount, onReveal }: PreRevealFooterProps) {
  return (
    <Button variant="primary" disabled={submittedCount === 0} onClick={onReveal}>
      {submittedCount === 0
        ? 'Reveal estimates'
        : `Reveal estimates (${submittedCount} submitted)`}
    </Button>
  )
}

interface NavFooterProps {
  isFirst: boolean
  isLast: boolean
  onNavigatePrev: () => void
}

interface ReviewFooterProps extends NavFooterProps {
  submittedCount: number
  onFinalize: () => void
  onRetry: () => void
}

/** Footer once revealed and not yet recorded: finalize, or run the round again. */
export function ReviewFooter({
  submittedCount,
  isFirst,
  isLast,
  onNavigatePrev,
  onFinalize,
  onRetry,
}: ReviewFooterProps) {
  return (
    <NavRow isFirst={isFirst} onNavigatePrev={onNavigatePrev}>
      <Button
        variant="primary"
        style={{ flex: 1 }}
        disabled={submittedCount === 0}
        onClick={onFinalize}
      >
        {isLast ? 'Finalize & view summary' : 'Finalize & next →'}
      </Button>
      <Button variant="secondary" style={{ flex: 'none' }} onClick={onRetry}>
        Retry round
      </Button>
    </NavRow>
  )
}

interface FinalizedFooterProps extends NavFooterProps {
  onUpdate: () => void
  onReopen: () => void
}

/** Footer for an item that already has a recorded range: update it, or reopen
 *  the item (armed by a confirming second click) to re-estimate. */
export function FinalizedFooter({
  isFirst,
  isLast,
  onNavigatePrev,
  onUpdate,
  onReopen,
}: FinalizedFooterProps) {
  const {
    armed: reopenArmed,
    handleClick: armAndReopen,
    ref: reopenRef,
  } = useConfirmArm<HTMLButtonElement>(onReopen)

  return (
    <>
      <p className="text-muted" style={{ margin: 0, fontSize: 13 }}>
        This item has a recorded range. Late submissions are ignored — to re-estimate,
        reopen the item.
      </p>
      <NavRow isFirst={isFirst} onNavigatePrev={onNavigatePrev}>
        <Button variant="primary" style={{ flex: 1 }} onClick={onUpdate}>
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
        <LiveRegion>
          <VisuallyHidden>
            {reopenArmed ? 'Click Reopen item again to confirm.' : ''}
          </VisuallyHidden>
        </LiveRegion>
      </NavRow>
    </>
  )
}
