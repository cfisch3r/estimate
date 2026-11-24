import { useState } from 'react'
import { useLoadSessionFile } from '../../../application'
import { describeLoadRejection } from '../lib/describeLoadRejection'
import { useFocusHandoff } from './focusHandoff'

/** A file that was picked and rejected, with the reason it can't be loaded. */
export type LoadRejection = { fileName: string; reason: string }

/** Loads a file the user picked, and keeps the rejection to announce. Focus is
 *  handed to the loaded session before loading, because the session renders as
 *  soon as the store holds it, which is before the load returns; a rejection
 *  withdraws that hand-off. */
export function useLoadPickedFile(): {
  rejection: LoadRejection | null
  loadPicked: (file: File) => Promise<void>
} {
  const load = useLoadSessionFile()
  const { handFocusTo } = useFocusHandoff()
  const [rejection, setRejection] = useState<LoadRejection | null>(null)

  async function loadPicked(file: File) {
    // Emptied first so a second, identical rejection is announced again.
    setRejection(null)
    handFocusTo('loaded-session')
    const result = await load(file)
    if (!result.ok) {
      handFocusTo(null)
      setRejection({ fileName: file.name, reason: describeLoadRejection(result.error) })
    }
  }

  return { rejection, loadPicked }
}
