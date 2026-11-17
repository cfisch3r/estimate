import { readFileSync } from 'node:fs'
import { parse } from 'yaml'
import type { ChangedFile } from './changedDiff.ts'
import { matchesPattern } from './reviewFloor.ts'
import type { Section } from './reviewSignals.ts'

// The changeset map of the Review guide: every changed file of a branch, placed in a layer
// and slice of the app or in a side strip. The layers, strips and the files left off the
// map come from the plugin's `changeset-map.yaml`, so nothing here is specific to this
// repository. The guide script calls this module; it has no command of its own.

export interface LayerConfig {
  name: string
  /** Layers of one group are drawn inside one frame. */
  group?: 'ui'
  /** Drawn as a column at the right edge; at most one layer. */
  side?: boolean
  /** The whole layer is one slice. */
  wholeSlice?: boolean
}

export interface StripConfig {
  name: string
  paths: string[]
}

export interface MapConfig {
  sourceRoot: string
  layers: LayerConfig[]
  strips: StripConfig[]
  offMap: string[]
}

export type Place =
  | { kind: 'layer'; layer: string; slice: string }
  | { kind: 'unplaced' }
  | { kind: 'strip'; strip: string }
  | { kind: 'off' }

/** The strip for files outside the source root that no configured strip matches. */
export const OTHER_STRIP = 'Other'

const TOP_KEYS = new Set(['sourceRoot', 'layers', 'strips', 'offMap'])
const LAYER_KEYS = new Set(['name', 'group', 'side', 'wholeSlice'])
const STRIP_KEYS = new Set(['name', 'paths'])
const GROUPS = new Set(['ui'])

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const isStringList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((v) => typeof v === 'string')

function mapping(
  value: unknown,
  where: string,
  keys: Set<string>,
): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`changeset-map.yaml: ${where} is not a mapping`)
  for (const key of Object.keys(value)) {
    if (!keys.has(key))
      throw new Error(`changeset-map.yaml: ${where}: unknown key "${key}"`)
  }
  return value
}

function list(value: unknown, where: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`changeset-map.yaml: ${where} is not a list`)
  return value
}

function text(value: unknown, where: string): string {
  if (typeof value !== 'string' || value === '') {
    throw new Error(`changeset-map.yaml: ${where} must be a non-empty string`)
  }
  return value
}

function flag(value: unknown, where: string): boolean | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'boolean')
    throw new Error(`changeset-map.yaml: ${where} must be true or false`)
  return value
}

/** The map configuration, checked; an error names the faulty field. */
export function parseMapConfig(source: string): MapConfig {
  const top = mapping(parse(source), 'the file', TOP_KEYS)

  const layers = list(top.layers, 'layers').map((entry, i): LayerConfig => {
    const where = `layers[${i}]`
    const row = mapping(entry, where, LAYER_KEYS)
    const layer: LayerConfig = { name: text(row.name, `${where}.name`) }
    if (row.group !== undefined) {
      if (typeof row.group !== 'string' || !GROUPS.has(row.group)) {
        throw new Error(`changeset-map.yaml: ${where}.group must be "ui"`)
      }
      layer.group = 'ui'
    }
    if (flag(row.side, `${where}.side`)) layer.side = true
    if (flag(row.wholeSlice, `${where}.wholeSlice`)) layer.wholeSlice = true
    return layer
  })
  if (layers.filter((l) => l.side).length > 1) {
    throw new Error('changeset-map.yaml: at most one layer can have side: true')
  }

  const strips = list(top.strips, 'strips').map((entry, i): StripConfig => {
    const where = `strips[${i}]`
    const row = mapping(entry, where, STRIP_KEYS)
    if (!isStringList(row.paths)) {
      throw new Error(`changeset-map.yaml: ${where}.paths must be a list of globs`)
    }
    return { name: text(row.name, `${where}.name`), paths: row.paths }
  })

  if (!isStringList(top.offMap)) {
    throw new Error('changeset-map.yaml: offMap must be a list of globs')
  }
  return {
    sourceRoot: text(top.sourceRoot, 'sourceRoot'),
    layers,
    strips,
    offMap: top.offMap,
  }
}

/** Where a changed file is drawn: off-map patterns first, then the source root, then the strips. */
export function placeFile(path: string, config: MapConfig): Place {
  if (config.offMap.some((glob) => matchesPattern(path, glob))) return { kind: 'off' }

  const root = `${config.sourceRoot}/`
  if (path.startsWith(root)) {
    const parts = path.slice(root.length).split('/')
    const layer = config.layers.find((l) => l.name === parts[0])
    if (!layer || parts.length < 2) return { kind: 'unplaced' }
    const slice = layer.wholeSlice
      ? layer.name
      : parts.length > 2
        ? (parts[1] ?? '')
        : '(root)'
    return { kind: 'layer', layer: layer.name, slice }
  }

  const strip = config.strips.find((s) =>
    s.paths.some((glob) => matchesPattern(path, glob)),
  )
  return { kind: 'strip', strip: strip?.name ?? OTHER_STRIP }
}

export type MapStatus = 'added' | 'changed' | 'deleted' | 'moved' | 'ghost'

export interface MapFile {
  path: string
  status: MapStatus
  /** The old path of a moved file. */
  from?: string
  /** The new path, on the ghost a moved file leaves at its old place. */
  movedTo?: string
}

export interface Folder {
  /** The full path; the key a reader collapses or opens it by. */
  path: string
  /** The folder's name, or a folded chain of single-child folders (`session-history/ui`). */
  label: string
  files: MapFile[]
  folders: Folder[]
  /** Files in this folder and below, ghosts not counted. */
  changed: number
  startsCollapsed: boolean
  /** False when the folder holds a single file in all. */
  collapsible: boolean
}

export interface LayerView {
  name: string
  group?: 'ui'
  side?: boolean
  root: Folder
}

export interface ChangesetMap {
  /** The configured layers in drawing order, then `Unplaced` when it holds files. */
  layers: LayerView[]
  /** The strips that hold files, in configured order, then `Other`. */
  strips: Array<{ name: string; files: MapFile[] }>
  /** Changed files left off the map. */
  offMap: number
}

/** A slice with more changed files than this starts collapsed. */
export const COLLAPSE_ABOVE = 4
const UNPLACED = 'Unplaced'
const ROOT_SLICE = '(root)'

const STATUS: Record<ChangedFile['status'], MapStatus> = {
  added: 'added',
  modified: 'changed',
  deleted: 'deleted',
  renamed: 'moved',
}

function mapFiles(files: ChangedFile[]): MapFile[] {
  return files.flatMap((f): MapFile[] =>
    f.status === 'renamed' && f.oldPath
      ? [
          { path: f.path, status: 'moved', from: f.oldPath },
          { path: f.oldPath, status: 'ghost', movedTo: f.path },
        ]
      : [{ path: f.path, status: STATUS[f.status] }],
  )
}

interface RawFolder {
  path: string
  name: string
  files: MapFile[]
  sub: Map<string, RawFolder>
}

const rawFolder = (path: string, name: string): RawFolder => ({
  path,
  name,
  files: [],
  sub: new Map(),
})

function addFile(root: RawFolder, dirs: string[], file: MapFile) {
  let folder = root
  for (const dir of dirs) {
    let next = folder.sub.get(dir)
    if (!next) {
      next = rawFolder(`${folder.path}/${dir}`, dir)
      folder.sub.set(dir, next)
    }
    folder = next
  }
  folder.files.push(file)
}

const byName =
  <T>(key: (item: T) => string) =>
  (a: T, b: T) =>
    key(a).localeCompare(key(b))

/** Folds single-child chains below the layer, counts files and sets the starting state. */
function finish(raw: RawFolder, depth: number, sliceDepth: number | undefined): Folder {
  let folder = raw
  let label = raw.name
  while (depth > 0 && folder.files.length === 0 && folder.sub.size === 1) {
    folder = [...folder.sub.values()][0] as RawFolder
    label += `/${folder.name}`
  }
  const folders = [...folder.sub.values()]
    .map((f) => finish(f, depth + 1, sliceDepth))
    .sort(byName((f) => f.label))
  const files = [...folder.files].sort(byName((f) => f.path))
  const changed =
    files.filter((f) => f.status !== 'ghost').length +
    folders.reduce((sum, f) => sum + f.changed, 0)
  const total = files.length + folders.reduce((sum, f) => sum + count(f), 0)
  return {
    path: folder.path,
    label,
    files,
    folders,
    changed,
    startsCollapsed: depth === sliceDepth && changed > COLLAPSE_ABOVE,
    collapsible: total > 1,
  }
}

const count = (f: Folder): number =>
  f.files.length + f.folders.reduce((sum, sub) => sum + count(sub), 0)

/** The map of a branch's changed files, placed by the configuration. */
export function buildChangesetMap(
  changed: ChangedFile[],
  config: MapConfig,
): ChangesetMap {
  const roots = new Map(
    config.layers.map((l) => [
      l.name,
      rawFolder(`${config.sourceRoot}/${l.name}`, l.name),
    ]),
  )
  const unplaced = rawFolder(config.sourceRoot, UNPLACED)
  const strips = new Map<string, MapFile[]>(config.strips.map((s) => [s.name, []]))
  strips.set(OTHER_STRIP, [])
  let offMap = 0

  for (const file of mapFiles(changed)) {
    const place = placeFile(file.path, config)
    if (place.kind === 'off') {
      offMap++
    } else if (place.kind === 'strip') {
      strips.get(place.strip)?.push(file)
    } else if (place.kind === 'unplaced') {
      const dirs = file.path
        .slice(config.sourceRoot.length + 1)
        .split('/')
        .slice(0, -1)
      addFile(unplaced, dirs, file)
    } else {
      const root = roots.get(place.layer) as RawFolder
      const dirs = file.path
        .slice(root.path.length + 1)
        .split('/')
        .slice(0, -1)
      addFile(root, dirs.length === 0 ? [ROOT_SLICE] : dirs, file)
    }
  }

  const layers: LayerView[] = config.layers.map((l) => ({
    name: l.name,
    ...(l.group ? { group: l.group } : {}),
    ...(l.side ? { side: true } : {}),
    root: finish(roots.get(l.name) as RawFolder, 0, l.wholeSlice ? undefined : 1),
  }))
  if (unplaced.files.length > 0 || unplaced.sub.size > 0) {
    layers.push({ name: UNPLACED, root: finish(unplaced, 0, undefined) })
  }
  return {
    layers,
    strips: [...strips]
      .filter(([, files]) => files.length > 0)
      .map(([name, files]) => ({ name, files: files.sort(byName((f) => f.path)) })),
    offMap,
  }
}

/** The map, or why it is not available: a missing or invalid configuration file. */
export function readChangesetMap(
  changed: ChangedFile[],
  configPath: string,
): Section<ChangesetMap> {
  let source: string
  try {
    source = readFileSync(configPath, 'utf8')
  } catch {
    return { status: 'not available', reason: 'changeset-map.yaml not found' }
  }
  try {
    return { status: 'ok', ...buildChangesetMap(changed, parseMapConfig(source)) }
  } catch (error) {
    return {
      status: 'not available',
      reason: error instanceof Error ? error.message : String(error),
    }
  }
}
