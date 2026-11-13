/** Hands `text` to the browser as a download named `fileName`: a JSON blob
 *  behind a temporary object URL, clicked through a detached `<a download>`.
 *  Implements `FileDownloadApi` (`application/ports/fileDownloadContext.ts`). */
export function downloadTextFile(fileName: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}
