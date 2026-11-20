import { useState } from 'react'
import { diagnosisFileName, formatDiagnosisReport } from '../../domain/diagnosis/report'
import { useClipboard } from '../ports/clipboardContext'
import { useDiagnosticsLog } from '../ports/diagnosticsLogContext'
import { useFileDownload } from '../ports/fileDownloadContext'

/** The report is plain text, so a tester can read it before sending it. */
const REPORT_CONTENT_TYPE = 'text/plain'

export interface DiagnosisReport {
  /** False when browser storage is blocked: nothing could be recorded. */
  available: boolean
  /** The report text, as of when the page read the log. */
  report: string
  /** Hands the report to the user as a dated `.txt` file. */
  download: () => void
  /** Puts the report on the clipboard, and says whether that worked. */
  copy: () => Promise<'copied' | 'failed'>
  /** Empties the log, so a retry starts a clean recording. */
  clear: () => void
}

/** Read the connection diagnosis and hand it over (issue #229). The tester sends
 *  the downloaded file to the organiser directly; nothing is uploaded. */
export function useDiagnosisReport(appVersion: string): DiagnosisReport {
  const log = useDiagnosticsLog()
  const { download } = useFileDownload()
  const clipboard = useClipboard()
  const [reading, setReading] = useState(() => ({
    ...log.read(),
    generatedAt: new Date().toISOString(),
  }))

  const report = formatDiagnosisReport({ ...reading, appVersion })

  return {
    available: reading.available,
    report,
    download: () => {
      const now = new Date()
      const fileName = diagnosisFileName({
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        day: now.getDate(),
        hour: now.getHours(),
        minute: now.getMinutes(),
      })
      download(fileName, report, REPORT_CONTENT_TYPE)
    },
    copy: () =>
      clipboard.writeText(report).then(
        () => 'copied' as const,
        () => 'failed' as const,
      ),
    clear: () => {
      log.clear()
      setReading({ ...log.read(), generatedAt: new Date().toISOString() })
    },
  }
}
