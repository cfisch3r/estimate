import { createContext, useContext } from 'react'
import type { DiagnosticsLog } from './outbound/diagnosticsLog'

/** Provides the diagnostics log port (`./outbound/diagnosticsLog`) to the
 *  diagnosis use case. */
export const DiagnosticsLogContext = createContext<DiagnosticsLog | null>(null)

export function useDiagnosticsLog(): DiagnosticsLog {
  const log = useContext(DiagnosticsLogContext)
  if (log === null) {
    throw new Error(
      'useDiagnosticsLog must be used within a DiagnosticsLogContext provider',
    )
  }
  return log
}
