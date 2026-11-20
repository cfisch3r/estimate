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

/** The newest `cap` entries of a list in time order. */
export function keepNewest(entries: DiagnosticEntry[], cap: number): DiagnosticEntry[] {
  return entries.slice(Math.max(0, entries.length - cap))
}

/** The tabs none of whose entries are among the newest `cap` across all tabs:
 *  what a new tab may remove, so old tabs don't fill the storage. */
export function staleTabs(
  entriesPerTab: Record<string, DiagnosticEntry[]>,
  cap: number,
): string[] {
  const kept = new Set(keepNewest(mergeByTime(entriesPerTab), cap))
  return Object.entries(entriesPerTab)
    .filter(([, entries]) => !entries.some((entry) => kept.has(entry)))
    .map(([tab]) => tab)
}
