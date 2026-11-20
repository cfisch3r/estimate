import { useState } from 'react'
import { useDiagnosisReport } from '../../../application'
import { Button, Field, FieldLabel, LiveRegion, Textarea } from '../../../shared/ui'

const COPY_MESSAGES = {
  copied: 'Copied.',
  failed: "Couldn't copy. Use Download report instead.",
} as const

/** `/diagnosis`: what the browser recorded about its live-session connections,
 *  for a tester to send to the organiser after something went wrong (issue
 *  #229). A technical tool, reached by URL, not a screen of the domain flow. */
export function Diagnosis() {
  const { available, report, download, copy, clear } = useDiagnosisReport(__APP_VERSION__)
  const [copyMessage, setCopyMessage] = useState('')

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
          <Button
            variant="secondary"
            onClick={async () => setCopyMessage(COPY_MESSAGES[await copy()])}
          >
            Copy report
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              clear()
              setCopyMessage('')
            }}
          >
            Clear
          </Button>
        </div>
        <LiveRegion>{copyMessage}</LiveRegion>
      </div>
    </div>
  )
}
