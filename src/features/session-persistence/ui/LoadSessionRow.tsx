import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { FolderOpenIcon } from '@phosphor-icons/react/dist/csr/FolderOpen'
import { ActionRow } from '../../../shared/ui'
import { useLoadSessionFile } from '../../../application'
import { describeLoadRejection } from '../lib/describeLoadRejection'
import { useFocusHandoff } from '../model/focusHandoff'
import { LoadRejectedAlert } from './LoadRejectedAlert'
import type { LoadRejection } from './LoadRejectedAlert'

/** The "Load a saved session" row on mode selection, with the hidden file
 *  input it opens and the alert for a file that can't be loaded. A file that
 *  loads becomes the session (the page then shows `LoadedSessionCard`); one
 *  that doesn't leaves the session untouched and says why. */
export function LoadSessionRow() {
  const load = useLoadSessionFile()
  const { handFocusTo, takeFocus } = useFocusHandoff()
  const rowRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [rejection, setRejection] = useState<LoadRejection | null>(null)

  useEffect(() => {
    // Back from a discarded session: resume where the user started.
    if (takeFocus('load-row')) rowRef.current?.focus()
  }, [takeFocus])

  async function onFileChosen(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const file = input.files?.[0]
    // Cleared so picking the same file again (after fixing it) fires again.
    input.value = ''
    if (!file) return
    // Emptied first so a second, identical rejection is announced again.
    setRejection(null)
    // Handed before loading: the loaded session renders as soon as the store
    // holds it, which is before `load` returns.
    handFocusTo('loaded-session')
    const result = await load(file)
    if (!result.ok) {
      handFocusTo(null)
      setRejection({ fileName: file.name, reason: describeLoadRejection(result.error) })
    }
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
        onChange={(event) => void onFileChosen(event)}
      />
      <LoadRejectedAlert rejection={rejection} />
    </>
  )
}
