import { sessionFileName, writeSessionFile } from '../../domain/sessionFile'
import type { LocalDate } from '../../domain/sessionFile'
import { useFileDownload } from '../ports/fileDownloadContext'
import { useSessionStore } from '../stores'

function today(): LocalDate {
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() }
}

/** Save the session: write it as a file named after the session and today's
 *  local date, hand it to the user, and remember it as the saved state. A
 *  running live round is not part of the file, so saving is safe in any mode. */
export function useSaveSession(): () => void {
  const { download } = useFileDownload()

  return () => {
    const { sessionName, unit, items, markSaved } = useSessionStore.getState()
    const file = writeSessionFile({ sessionName, unit, items })
    download(sessionFileName(sessionName, today()), file)
    markSaved(file)
  }
}
