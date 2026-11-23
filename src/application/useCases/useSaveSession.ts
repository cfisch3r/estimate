import { savedSessionOf } from '../../domain/savedSession'
import type { LocalDate } from '../ports/outbound/sessionFiles'
import { useSessionFiles } from '../ports/sessionFilesContext'
import { useSessionStore } from '../stores'

function today(): LocalDate {
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() }
}

/** Save the session: hand what a save keeps to the user as a file dated with
 *  today's local date, and remember it as the saved state. A running live
 *  round is not part of a saved session, so saving is safe in any mode.
 *  Returns the file's name, for the UI to confirm the save. */
export function useSaveSession(): () => string {
  const sessionFiles = useSessionFiles()

  return () => {
    const { sessionName, unit, items, markSaved } = useSessionStore.getState()
    const saved = savedSessionOf({ sessionName, unit, items })
    const fileName = sessionFiles.save(saved, today())
    markSaved(saved)
    return fileName
  }
}
