import type { DiagnosticEntry } from './types'

/** How many entries the diagnosis keeps across all tabs. */
export const DIAGNOSTICS_CAP = 500

/** Every tab's entries in one list, oldest first. Entries recorded at the same
 *  time keep their recorded order. */
export function mergeByTime(
  entriesPerTab: Record<string, DiagnosticEntry[]>,
): DiagnosticEntry[] {
  return Object.values(entriesPerTab)
    .flat()
    .sort((a, b) => a.at.localeCompare(b.at))
}

/** Each tab's entries with the oldest dropped, across all tabs, until at most
 *  `cap` remain. */
export function trimToCap(
  entriesPerTab: Record<string, DiagnosticEntry[]>,
  cap: number,
): Record<string, DiagnosticEntry[]> {
  const merged = mergeByTime(entriesPerTab)
  const kept = new Set(merged.slice(Math.max(0, merged.length - cap)))
  return Object.fromEntries(
    Object.entries(entriesPerTab).map(([tab, entries]) => [
      tab,
      entries.filter((entry) => kept.has(entry)),
    ]),
  )
}
