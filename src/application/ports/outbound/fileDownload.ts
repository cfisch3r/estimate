// The port through which the save use case hands a finished file to the user.
// The application layer owns this interface; `adapters/file` implements it and
// `app/` provides it (ADR-009). No React here, so adapters and specs may import it.

export interface FileDownloadApi {
  /** Hands `text` to the user as a file named `fileName`, typed `contentType`
   *  (a MIME type such as `application/json`). */
  download: (fileName: string, text: string, contentType: string) => void
}
