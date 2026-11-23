import { GuardNote, LiveRegion } from '../../../shared/ui'
import type { LoadRejection } from '../model/useLoadPickedFile'

/** Announces a rejected file and why. The region stays mounted and only its
 *  content changes, so screen readers announce each rejection. */
export function LoadRejectedAlert({ rejection }: { rejection: LoadRejection | null }) {
  return (
    <LiveRegion role="alert">
      {rejection && (
        <GuardNote variant="banner" headline="This file can’t be loaded">
          <p style={{ margin: 0 }}>{rejection.reason}</p>
          {/* A solid neutral, not .text-muted: the muted mix drops below AA
              contrast on the warning banner's tinted background. */}
          <p
            style={{
              margin: 'var(--space-1) 0 0',
              fontSize: 11,
              color: 'var(--color-neutral-300)',
            }}
          >
            {rejection.fileName} · nothing was changed
          </p>
        </GuardNote>
      )}
    </LiveRegion>
  )
}
