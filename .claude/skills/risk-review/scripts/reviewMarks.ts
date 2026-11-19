import type { HotSpot, SkimItem } from './reviewGuide.ts'
import { matchesPattern } from './reviewFloor.ts'
import type { ChangesetMap, Folder, MapFile } from './reviewMap.ts'

// What the agent's answer marks on the changeset map: each hot spot's number on its file,
// the skim-only files faded with their reason, and one sentence on what a changed file is
// for. Every mark is keyed by a path the map draws, as a box or as a strip row; a mark for
// any other file is left out, so the page never points at a box that is not there.

export interface Responsibility {
  file: string
  text: string
}

export interface MapMarks {
  /** Path → the numbers of its hot spots, as the guide lists them (1-based). */
  spots: Record<string, number[]>
  /** Changed path → the skim-only entry it falls under; hot spot files are never skim-only. */
  skim: Record<string, { entry: string; why: string }>
  /** Path → what the file is for; only changed files drawn as boxes, not skim-only. */
  responsibilities: Record<string, string>
}

/**
 * The first skim-only entry a path falls under. An entry ending in `/` is a folder, one with
 * a wildcard a glob, any other the exact path or a folder written without the slash.
 */
export function skimEntryFor(path: string, skim: SkimItem[]): SkimItem | undefined {
  return skim.find((item) => {
    const entry = item.file.trim().replace(/^\.\//, '')
    if (entry.endsWith('/')) return matchesPattern(path, `${entry}**`)
    if (/[*?[\]{}]/.test(entry)) return matchesPattern(path, entry)
    return path === entry || path.startsWith(`${entry}/`)
  })
}

const NOT_CHANGED = new Set(['context', 'importer', 'ghost'])

function layerFiles(folder: Folder): MapFile[] {
  return [...folder.files, ...folder.folders.flatMap(layerFiles)]
}

export function mapMarks(
  map: ChangesetMap,
  hotSpots: HotSpot[],
  skim: SkimItem[],
  responsibilities: Responsibility[],
): MapMarks {
  const boxes = map.layers
    .flatMap((layer) => layerFiles(layer.root))
    .filter((f) => f.status !== 'ghost')
  const drawn = new Set([
    ...boxes.map((f) => f.path),
    ...map.strips.flatMap((s) => s.files.map((f) => f.path)),
  ])

  const spots: MapMarks['spots'] = {}
  hotSpots.forEach((spot, i) => {
    if (drawn.has(spot.file)) (spots[spot.file] ??= []).push(i + 1)
  })

  // Only changed files are skim-only: an unchanged box only shows where a change reaches.
  const changed = new Set([
    ...boxes.filter((f) => !NOT_CHANGED.has(f.status)).map((f) => f.path),
    ...map.strips.flatMap((s) => s.files.map((f) => f.path)),
  ])
  const faded: MapMarks['skim'] = {}
  for (const path of changed) {
    if (spots[path]) continue
    const item = skimEntryFor(path, skim)
    if (item) faded[path] = { entry: item.file, why: item.why }
  }

  const said: MapMarks['responsibilities'] = {}
  for (const { file, text } of responsibilities) {
    if (
      changed.has(file) &&
      boxes.some((f) => f.path === file) &&
      !faded[file] &&
      !(file in said)
    )
      said[file] = text
  }
  return { spots, skim: faded, responsibilities: said }
}
