import { readSessionFile } from '../../domain/sessionFile'
import type { Result } from '../../domain/estimate'
import { useSessionStore } from '../stores'

/** Load a session file's text into the session: the whole session, or — if
 *  the file breaks a rule — nothing, with the reason. Only offered before a
 *  mode starts, because a live session has no message for replacing the item
 *  list under connected participants. */
export function useLoadSessionFile(): (text: string, fileName: string) => Result<void> {
  const loadSession = useSessionStore((s) => s.loadSession)

  return (text, fileName) => {
    const read = readSessionFile(text)
    if (!read.ok) return read
    loadSession(read.value, fileName)
    return { ok: true, value: undefined }
  }
}
