// The port through which the diagnosis page hands its report to the clipboard
// (issue #229). The application layer owns this interface; `adapters/clipboard`
// implements it and `app/` provides it (ADR-009). No React here.

export interface ClipboardApi {
  /** Puts `text` on the clipboard. Rejects when the browser refuses, such as
   *  without permission or outside a secure context. */
  writeText: (text: string) => Promise<void>
}
