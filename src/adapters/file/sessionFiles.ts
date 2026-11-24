import type { SessionFileApi } from '../../application/ports/outbound/sessionFiles'
import { downloadTextFile } from './fileDownload'
import {
  SESSION_FILE_CONTENT_TYPE,
  readSessionFile,
  writeSessionFile,
} from './sessionFileFormat'
import { sessionFileName } from './sessionFileName'

/** Saves a session as a version-1 file the browser downloads, and opens a file
 *  the user picked. Implements `SessionFileApi`
 *  (`application/ports/outbound/sessionFiles.ts`). */
export const sessionFiles: SessionFileApi = {
  save(session, savedOn) {
    const fileName = sessionFileName(session.sessionName, savedOn)
    downloadTextFile(fileName, writeSessionFile(session), SESSION_FILE_CONTENT_TYPE)
    return fileName
  },

  async open(file) {
    let text: string
    try {
      text = await file.text()
    } catch {
      // The file was moved, deleted or locked after it was picked.
      return { ok: false, error: { code: 'unreadable' } }
    }
    return readSessionFile(text)
  },
}
