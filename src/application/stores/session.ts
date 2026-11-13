import { create } from 'zustand'
import { DEFAULT_ESTIMATION_UNIT } from '../../domain/estimate'
import type { EstimationUnit } from '../../domain/estimate'
import {
  appendItem,
  firstPendingItemId,
  moveItem,
  removeItemFrom,
  renameItem,
  updateItem,
} from '../../domain/item'
import { writeSessionFile } from '../../domain/sessionFile'
import type { SavedSession } from '../../domain/sessionFile'
import type { Item } from '../../domain/types'

export interface SessionStore {
  sessionName: string
  unit: EstimationUnit
  items: Item[]
  activeItemId: string | null
  /** The last file this session was saved to or loaded from, as
   *  `writeSessionFile` wrote it — what "unsaved changes" compares against.
   *  Null until the first save or load. */
  lastSavedFile: string | null
  /** The name of the file this session was loaded from, until the session is
   *  reset — what tells mode selection a loaded session is waiting to start.
   *  Null for a session that wasn't loaded. */
  loadedFrom: string | null

  setSessionName: (name: string) => void
  setUnit: (unit: EstimationUnit) => void
  addItem: (title: string, description?: string) => void
  setItemTitle: (id: string, title: string) => void
  removeItem: (id: string) => void
  reorderItems: (fromIndex: number, toIndex: number) => void
  /** Passing null clears the selection (e.g. after finalizing the last item
   *  that still needed one), showing the "all items finalized" empty state. */
  selectItem: (id: string | null) => void
  /** Select the first item that still needs an estimate (null if none). */
  selectFirstPending: () => void
  setItemNotes: (id: string, notes: string) => void
  setItemDescription: (id: string, description: string) => void
  /** Back to a new session: every field as it starts, the default unit
   *  included — a participant's unit and name come from the facilitator's
   *  snapshot and must not leak into the next session. The one definition of
   *  "blank", shared by leaving and by discarding a loaded file. Composed with
   *  the other two stores' own resets by `useTeardownLiveSession` (ADR-005). */
  resetSession: () => void
  /** Replace the whole session with one read from the file `fileName`.
   *  Nothing is selected yet: starting a mode selects the first item still
   *  needing an estimate. */
  loadSession: (session: SavedSession, fileName: string) => void
  /** Record `file` as the session's last saved state. */
  markSaved: (file: string) => void
}

const NEW_SESSION = {
  sessionName: '',
  unit: DEFAULT_ESTIMATION_UNIT,
  items: [],
  activeItemId: null,
  lastSavedFile: null,
  loadedFrom: null,
} satisfies Partial<SessionStore>

export const useSessionStore = create<SessionStore>((set) => ({
  ...NEW_SESSION,

  setSessionName: (name) => set({ sessionName: name }),

  setUnit: (unit) => set({ unit }),

  addItem: (title, description = '') =>
    set(
      (state) =>
        appendItem(state, { id: crypto.randomUUID(), title, description }) ?? state,
    ),

  setItemTitle: (id, title) =>
    set((state) => {
      const items = renameItem(state.items, id, title)
      return items ? { items } : {}
    }),

  removeItem: (id) => set((state) => removeItemFrom(state, id)),

  reorderItems: (fromIndex, toIndex) =>
    set((state) => {
      const items = moveItem(state.items, fromIndex, toIndex)
      return items ? { items } : {}
    }),

  selectItem: (id) => set({ activeItemId: id }),
  selectFirstPending: () =>
    set((state) => ({ activeItemId: firstPendingItemId(state.items) })),

  setItemNotes: (id, notes) =>
    set((state) => ({ items: updateItem(state.items, id, { notes }) })),

  setItemDescription: (id, description) =>
    set((state) => ({ items: updateItem(state.items, id, { description }) })),

  resetSession: () => set(NEW_SESSION),

  loadSession: (session, fileName) =>
    set({
      sessionName: session.sessionName,
      unit: session.unit,
      items: session.items,
      activeItemId: null,
      lastSavedFile: writeSessionFile(session),
      loadedFrom: fileName,
    }),

  markSaved: (file) => set({ lastSavedFile: file }),
}))

/** Merge a round outcome into item `id`. Module-level (not a store action) and
 *  consumed only by `round.ts`, so round mechanics stay out of this store's
 *  interface — see ADR-005, Option D. Scoped to round-owned fields, so it can't
 *  bypass `setItemTitle`/`setItemNotes`/`setItemDescription`'s validation of the
 *  content fields they own. */
export function patchItem(
  id: string,
  patch: Partial<Pick<Item, 'finalResult' | 'revealed' | 'round' | 'submissions'>>,
): void {
  useSessionStore.setState((state) => ({ items: updateItem(state.items, id, patch) }))
}
