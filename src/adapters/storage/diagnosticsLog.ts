import type {
  DiagnosticsLog,
  DiagnosticsReading,
} from '../../application/ports/outbound/diagnosticsLog'
import { DIAGNOSTICS_CAP, mergeByTime, trimToCap } from '../../domain/diagnosis/log'
import type { DiagnosticEntry } from '../../domain/diagnosis/types'

/** Each tab writes only under its own key, so two tabs never overwrite each
 *  other's latest entry; reading merges every key. */
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

/** The connection diagnosis's log in browser storage (issue #229). Recording
 *  must never get in the way of the live session: every storage access is
 *  caught, and after the first failure the log stops recording and reports
 *  itself unavailable. */
export function createDiagnosticsLog(
  options: DiagnosticsLogOptions = {},
): DiagnosticsLog {
  const storage = options.storage ?? (() => localStorage)
  const tabId = options.tabId ?? Math.random().toString(36).slice(2, 6).padEnd(4, '0')
  const now = options.now ?? (() => new Date().toISOString())
  const userAgent = options.userAgent ?? globalThis.navigator?.userAgent ?? ''

  let available = probe()

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

  /** Every tab's entries, skipping a value that isn't a list of entries. */
  function readAll(store: Storage): Record<string, DiagnosticEntry[]> {
    const perTab: Record<string, DiagnosticEntry[]> = {}
    for (const key of diagnosticsKeys(store)) {
      try {
        const value: unknown = JSON.parse(store.getItem(key) ?? '[]')
        if (isEntryList(value)) perTab[key] = value
      } catch {
        // A corrupt value is left out of the report, not allowed to break it.
      }
    }
    return perTab
  }

  return {
    record(event, role) {
      if (!available) return
      try {
        const store = storage()
        const entry: DiagnosticEntry = {
          ...event,
          at: now(),
          tab: tabId,
          ...(role ? { role } : {}),
        }
        const perTab = readAll(store)
        const ownKey = `${KEY_PREFIX}${tabId}`
        perTab[ownKey] = [...(perTab[ownKey] ?? []), entry]
        const before = Object.fromEntries(
          Object.entries(perTab).map(([key, entries]) => [key, entries.length]),
        )
        for (const [key, entries] of Object.entries(trimToCap(perTab, DIAGNOSTICS_CAP))) {
          if (entries.length === 0) store.removeItem(key)
          else if (key === ownKey || entries.length !== before[key]) {
            store.setItem(key, JSON.stringify(entries))
          }
        }
      } catch {
        available = false
      }
    },

    read(): DiagnosticsReading {
      if (available) {
        try {
          return {
            available: true,
            entries: mergeByTime(readAll(storage())),
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
