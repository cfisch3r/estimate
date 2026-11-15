import { DownloadSimpleIcon } from '@phosphor-icons/react/dist/csr/DownloadSimple'
import { useState } from 'react'
import { Button, LiveRegion, VisuallyHidden } from '../../../shared/ui'
import { useSaveSession, useSaveState } from '../../../application'
import './save-session-button.css'

/** Downloads the session as a file. While the session holds changes no file
 *  has, the button shows an amber dot and its name says so. Renders nothing
 *  for a client that has no session of its own to save (a participant). */
export function SaveSessionButton() {
  const save = useSaveSession()
  const { canSave, unsaved } = useSaveState()
  // The browser's own download UI isn't read out reliably, so a save is also
  // announced. Emptied first, so saving again announces again.
  const [savedAs, setSavedAs] = useState('')
  if (!canSave) return null

  return (
    <>
      <Button
        variant="secondary"
        className={
          unsaved
            ? 'save-session-button save-session-button-unsaved'
            : 'save-session-button'
        }
        aria-label={unsaved ? 'Save session (unsaved changes)' : undefined}
        onClick={() => {
          setSavedAs('')
          const fileName = save()
          queueMicrotask(() => setSavedAs(fileName))
        }}
      >
        <DownloadSimpleIcon size={16} aria-hidden />
        Save session
        {unsaved && <span className="save-session-dot" aria-hidden />}
      </Button>
      <LiveRegion>
        <VisuallyHidden>{savedAs && `Session saved as ${savedAs}`}</VisuallyHidden>
      </LiveRegion>
    </>
  )
}
