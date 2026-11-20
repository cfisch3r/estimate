import type {
  DiagnosticsLog,
  DiagnosticsReading,
} from '../../application/ports/outbound/diagnosticsLog'
import {
  DIAGNOSTICS_CAP,
  keepNewest,
  mergeByTime,
  staleTabs,
} from '../../domain/diagnosis/log'
import type { DiagnosticEntry } from '../../domain/diagnosis/types'

/** Each tab writes only under its own key, so two tabs never overwrite each
 *  other's entries; reading merges every key. */
const KEY_PREFIX = 'estimate.diagnostics.'
/** Outside the prefix, so a read never mistakes it for a tab. */
const PROBE_KEY = 'estimate.diagnosticsProbe'

export interface DiagnosticsLogOptions {
  /** Where entries live; `localStorage` by default. A getter, because merely
   *  touching `localStorage` throws in some locked-down browsers. */
  storage?: () => Storage
  /** This tab's label in the report; random by default. */
  tabId?: string
  /** The time of an entry, ISO 8601; the current time by default. */
  now?: () => string
  userAgent?: string
}

function isEntryList(value: unknown): value is DiagnosticEntry[] {
  return Array.isArray(value)
}

/** The diagnostics log in browser storage (issue #229). Recording must never get
 *  in the way of the live session: every storage access is caught, and after
 *  the first failure the log stops recording and reports itself unavailable.
 *  A tab keeps at most 500 entries under its own key and a read keeps the
 *  newest 500 across tabs; a new tab removes the keys of tabs none of whose
 *  entries a read would keep, so old tabs don't fill the storage. */
export function createDiagnosticsLog(
  options: DiagnosticsLogOptions = {},
): DiagnosticsLog {
  const storage = options.storage ?? (() => localStorage)
  const tabId = options.tabId ?? Math.random().toString(36).slice(2, 6).padEnd(4, '0')
  const now = options.now ?? (() => new Date().toISOString())
  const userAgent = options.userAgent ?? globalThis.navigator?.userAgent ?? ''

  let available = probe()
  if (available) removeStaleTabs()

  function probe(): boolean {
    try {
      storage().setItem(PROBE_KEY, '1')
      storage().removeItem(PROBE_KEY)
      return true
    } catch {
      return false
    }
  }

  function diagnosticsKeys(store: Storage): string[] {
    return Array.from({ length: store.length }, (_, index) => store.key(index)).filter(
      (key): key is string => key?.startsWith(KEY_PREFIX) ?? false,
    )
  }

  /** The entries under `key`, or none for a value that isn't a list of them. */
  function readKey(store: Storage, key: string): DiagnosticEntry[] {
    try {
      const value: unknown = JSON.parse(store.getItem(key) ?? '[]')
      return isEntryList(value) ? value : []
    } catch {
      // A corrupt value is left out of the report, not allowed to break it.
      return []
    }
  }

  /** Every tab's entries, by key. */
  function readAll(store: Storage): Record<string, DiagnosticEntry[]> {
    return Object.fromEntries(
      diagnosticsKeys(store).map((key) => [key, readKey(store, key)]),
    )
  }

  function removeStaleTabs(): void {
    try {
      const store = storage()
      for (const key of staleTabs(readAll(store), DIAGNOSTICS_CAP)) store.removeItem(key)
    } catch {
      available = false
    }
  }

  const ownKey = `${KEY_PREFIX}${tabId}`

  return {
    record(event) {
      if (!available) return
      try {
        const store = storage()
        const entry: DiagnosticEntry = { ...event, at: now(), tab: tabId }
        const own = readKey(store, ownKey)
        store.setItem(
          ownKey,
          JSON.stringify(keepNewest([...own, entry], DIAGNOSTICS_CAP)),
        )
      } catch {
        available = false
      }
    },

    read(): DiagnosticsReading {
      if (available) {
        try {
          return {
            available: true,
            entries: keepNewest(mergeByTime(readAll(storage())), DIAGNOSTICS_CAP),
            userAgent,
          }
        } catch {
          available = false
        }
      }
      return { available: false, entries: [], userAgent }
    },

    clear() {
      try {
        const store = storage()
        for (const key of diagnosticsKeys(store)) store.removeItem(key)
      } catch {
        // Nothing to clear when storage can't be reached.
      }
    },
  }
}
