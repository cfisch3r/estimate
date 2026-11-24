import { createContext, useContext } from 'react'
import type { SessionFileApi } from './outbound/sessionFiles'

/** Provides the session-file port (`./outbound/sessionFiles`) to the save and
 *  load use cases. */
export const SessionFilesContext = createContext<SessionFileApi | null>(null)

export function useSessionFiles(): SessionFileApi {
  const api = useContext(SessionFilesContext)
  if (api === null) {
    throw new Error('useSessionFiles must be used within a SessionFilesContext provider')
  }
  return api
}
