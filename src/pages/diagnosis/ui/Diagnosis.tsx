import { useState } from 'react'
import { useDiagnosisReport } from '../../../application'
import { useConfirmArm } from '../../../shared/lib/useConfirmArm'
import { Button, Field, FieldLabel, LiveRegion, Textarea } from '../../../shared/ui'

const MESSAGES = {
  copied: 'Copied.',
  failed: "Couldn't copy. Use Download report instead.",
  armed: 'Click Clear again to delete the recording.',
  cleared: 'Report cleared.',
} as const

/** `/diagnosis`: what the browser recorded about its live-session connections,
 *  for a tester to send to the organiser after something went wrong (issue
 *  #229). A technical tool, reached by URL, not a screen of the domain flow. */
export function Diagnosis() {
  const { available, report, download, copy, clear } = useDiagnosisReport(__APP_VERSION__)
  // `count` gives every message a new node, so the same message said twice is
  // announced twice.
  const [message, setMessage] = useState<{ text: string; count: number }>({
    text: '',
    count: 0,
  })
  const say = (text: string) => setMessage(({ count }) => ({ text, count: count + 1 }))
  const {
    armed: clearArmed,
    handleClick: armAndClear,
    ref: clearRef,
  } = useConfirmArm<HTMLButtonElement>(() => {
    clear()
    say(MESSAGES.cleared)
  })

  return (
    <div
      style={{
        maxWidth: 760,
        margin: '0 auto',
        padding: 'var(--space-6) var(--space-4)',
      }}
    >
      <div className="card" style={{ padding: 'var(--space-6)', gap: 'var(--space-4)' }}>
        <h1 style={{ margin: 0, fontWeight: 500, fontSize: 22 }}>Connection diagnosis</h1>
        <p className="card-body" style={{ margin: 0 }}>
          If something went wrong with a live session, download this report and send the
          file to the organiser directly, not through the feedback form. It contains no
          names, estimates or addresses.
        </p>
        {!available && (
          <p className="card-body" style={{ margin: 0 }}>
            This browser could not record anything, because its browser storage is blocked
            (for example in a private window).
          </p>
        )}
        <Field>
          <FieldLabel htmlFor="diagnosis-report">Diagnosis report</FieldLabel>
          <Textarea
            id="diagnosis-report"
            readOnly
            value={report}
            rows={16}
            spellCheck={false}
            style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 12 }}
          />
        </Field>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
          <Button variant="primary" onClick={download}>
            Download report
          </Button>
          <Button variant="secondary" onClick={async () => say(MESSAGES[await copy()])}>
            Copy report
          </Button>
          <Button
            ref={clearRef}
            variant="ghost"
            style={{ color: clearArmed ? 'var(--color-warning)' : undefined }}
            onClick={armAndClear}
          >
            {clearArmed ? 'Click again to clear' : 'Clear'}
          </Button>
        </div>
        {/* Renaming the focused Clear button alone is announced unreliably, so
            its armed prompt is also said here. */}
        <LiveRegion>
          {clearArmed ? (
            <span key="armed">{MESSAGES.armed}</span>
          ) : (
            <span key={message.count}>{message.text}</span>
          )}
        </LiveRegion>
      </div>
    </div>
  )
}
