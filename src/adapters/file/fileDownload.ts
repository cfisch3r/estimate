/** How long the object URL outlives the click. Some browsers start the
 *  download only after `click()` returns, and fail it if the URL is already
 *  revoked; a minute is far longer than any start takes. */
const REVOKE_AFTER_MS = 60_000

/** Hands `text` to the browser as a download named `fileName`: a JSON blob
 *  behind a temporary object URL, clicked through a detached `<a download>`.
 *  Implements `FileDownloadApi` (`application/ports/fileDownloadContext.ts`). */
export function downloadTextFile(fileName: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), REVOKE_AFTER_MS)
}
