import { holdsItemList } from '../../domain/connection'
import { hasUnsavedChanges } from '../../domain/savedSession'
import type { SessionStore } from '../stores/session'
import { useConnectionStore, useSessionStore } from '../stores'

type Saveable = Pick<SessionStore, 'sessionName' | 'unit' | 'items' | 'savedBaseline'>

let last: { state: Saveable; unsaved: boolean } | null = null

/** `hasUnsavedChanges` for the store's current fields, worked out once per
 *  change rather than once per subscriber: the check walks every item, and
 *  several components ask on every store update. */
function unsavedFor(state: Saveable): boolean {
  if (
    last !== null &&
    last.state.sessionName === state.sessionName &&
    last.state.unit === state.unit &&
    last.state.items === state.items &&
    last.state.savedBaseline === state.savedBaseline
  ) {
    return last.unsaved
  }
  const unsaved = hasUnsavedChanges(state, state.savedBaseline)
  last = { state, unsaved }
  return unsaved
}

/** Whether this client has a session it can save (it holds the item list),
 *  and whether that session holds changes the last save or load doesn't have. A
 *  participant can't save and so never has unsaved changes. */
export function useSaveState(): { canSave: boolean; unsaved: boolean } {
  const canSave = useConnectionStore((s) => holdsItemList(s.role))
  const unsaved = useSessionStore((s) => canSave && unsavedFor(s))
  return { canSave, unsaved }
}
