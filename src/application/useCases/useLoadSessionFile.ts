import type { Result } from '../../domain/estimate'
import type { PickedFile, SessionFileRejection } from '../ports/outbound/sessionFiles'
import { useSessionFiles } from '../ports/sessionFilesContext'
import { useSessionStore } from '../stores'

/** Load a file the user picked into the session: the whole session, or — if
 *  the file can't be read or breaks a rule — nothing, with the reason. Only
 *  offered before a mode starts, because a live session has no message for
 *  replacing the item list under connected participants. */
export function useLoadSessionFile(): (
  file: PickedFile,
) => Promise<Result<void, SessionFileRejection>> {
  const sessionFiles = useSessionFiles()
  const loadSession = useSessionStore((s) => s.loadSession)

  return async (file) => {
    const opened = await sessionFiles.open(file)
    if (!opened.ok) return opened
    loadSession(opened.value, file.name)
    return { ok: true, value: undefined }
  }
}
