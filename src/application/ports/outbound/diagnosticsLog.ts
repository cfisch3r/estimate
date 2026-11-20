import type { SessionRole } from '../../../domain/types'
import type { DiagnosticEntry, DiagnosticEvent } from '../../../domain/diagnosis/types'

// The port through which the live session and the network adapter record what
// happened to a connection, and through which the diagnosis page reads it back
// (issue #229). The application layer owns this interface; `adapters/storage`
// implements it and `app/` provides it (ADR-009). No React here, so adapters and
// specs may import it.

/** What a read returns: every tab's entries, merged in time order. */
export interface DiagnosticsReading {
  /** False when browser storage can't be used: nothing was or will be recorded. */
  available: boolean
  entries: DiagnosticEntry[]
  /** The browser's user agent, for the report's header. */
  userAgent: string
}

export interface DiagnosticsLog {
  /** Records `event` for this tab. Never throws, and does nothing when storage
   *  is unavailable. */
  record: (event: DiagnosticEvent, role?: SessionRole) => void
  read: () => DiagnosticsReading
  /** Removes every tab's entries. */
  clear: () => void
}
