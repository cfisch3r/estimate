import { hasUnsavedChanges } from '../../domain/sessionFile'
import { useSessionStore } from '../stores'

/** Whether the session holds changes that no saved or loaded file has. */
export function useHasUnsavedChanges(): boolean {
  return useSessionStore((s) =>
    hasUnsavedChanges(
      { sessionName: s.sessionName, unit: s.unit, items: s.items },
      s.lastSavedFile,
    ),
  )
}
