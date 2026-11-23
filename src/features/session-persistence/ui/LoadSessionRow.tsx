import { useEffect, useRef } from 'react'
import type { ChangeEvent } from 'react'
import { FolderOpenIcon } from '@phosphor-icons/react/dist/csr/FolderOpen'
import { ActionRow } from '../../../shared/ui'
import { useFocusHandoff } from '../model/focusHandoff'
import { useLoadPickedFile } from '../model/useLoadPickedFile'
import { LoadRejectedAlert } from './LoadRejectedAlert'

/** The "Load a saved session" row on mode selection, with the hidden file
 *  input it opens and the alert for a file that can't be loaded. A file that
 *  loads becomes the session (the page then shows `LoadedSessionCard`); one
 *  that doesn't leaves the session untouched and says why. */
export function LoadSessionRow() {
  const { takeFocus } = useFocusHandoff()
  const { rejection, loadPicked } = useLoadPickedFile()
  const rowRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Back from a discarded session: resume where the user started.
    if (takeFocus('load-row')) rowRef.current?.focus()
  }, [takeFocus])

  function onFileChosen(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const file = input.files?.[0]
    // Cleared so picking the same file again (after fixing it) fires again.
    input.value = ''
    if (file) void loadPicked(file)
  }

  return (
    <>
      <ActionRow
        ref={rowRef}
        icon={<FolderOpenIcon size={22} />}
        title="Load a saved session"
        description="Continue from a .estimate.json file you saved earlier."
        onClick={() => inputRef.current?.click()}
      />
      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={onFileChosen}
      />
      <LoadRejectedAlert rejection={rejection} />
    </>
  )
}
