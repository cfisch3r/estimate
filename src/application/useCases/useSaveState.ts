import { holdsItemList } from '../../domain/connection'
import { hasUnsavedChanges } from '../../domain/sessionFile'
import type { SessionStore } from '../stores/session'
import { useConnectionStore, useSessionStore } from '../stores'

type Saveable = Pick<SessionStore, 'sessionName' | 'unit' | 'items' | 'lastSavedFile'>

let last: { state: Saveable; unsaved: boolean } | null = null

/** `hasUnsavedChanges` for the store's current fields, worked out once per
 *  change rather than once per subscriber: the check serialises the whole
 *  session, and several components ask on every store update. */
function unsavedFor(state: Saveable): boolean {
  if (
    last !== null &&
    last.state.sessionName === state.sessionName &&
    last.state.unit === state.unit &&
    last.state.items === state.items &&
    last.state.lastSavedFile === state.lastSavedFile
  ) {
    return last.unsaved
  }
  const unsaved = hasUnsavedChanges(state, state.lastSavedFile)
  last = { state, unsaved }
  return unsaved
}

/** Whether this client has a session it can save (it holds the item list),
 *  and whether that session holds changes no saved or loaded file has. A
 *  participant can't save and so never has unsaved changes. */
export function useSaveState(): { canSave: boolean; unsaved: boolean } {
  const canSave = useConnectionStore((s) => holdsItemList(s.role))
  const unsaved = useSessionStore((s) => canSave && unsavedFor(s))
  return { canSave, unsaved }
}
