import { parse } from 'yaml'
import type { ChangedFile } from './changedDiff.ts'
import { matchesPattern } from './reviewFloor.ts'
import type { ExportInfo } from './reviewExports.ts'
import type { CodeChanges, ImportChange } from './reviewImports.ts'
import type { Section } from './reviewSignals.ts'

// The changeset map of the Review guide: every changed file of a branch, placed in a layer
// and slice of the app or in a side strip. The layers, strips and the files left off the
// map come from the `map` part of the project's `pr-review-guide.yaml`, so nothing here is
// specific to this repository. The guide script calls this module; it has no command of its own.

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
/** The row for files below the source root that no configured layer matches. */
const UNPLACED = 'Unplaced'

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
  // `where` is empty for the map settings themselves.
  const at =
    where === '' ? 'pr-review-guide.yaml: map' : `pr-review-guide.yaml: map: ${where}`
  if (!isRecord(value)) throw new Error(`${at} is not a mapping`)
  for (const key of Object.keys(value)) {
    if (!keys.has(key)) throw new Error(`${at}: unknown key "${key}"`)
  }
  return value
}

function list(value: unknown, where: string): unknown[] {
  if (!Array.isArray(value))
    throw new Error(`pr-review-guide.yaml: map: ${where} is not a list`)
  return value
}

function text(value: unknown, where: string): string {
  if (typeof value !== 'string' || value === '') {
    throw new Error(`pr-review-guide.yaml: map: ${where} must be a non-empty string`)
  }
  return value
}

function flag(value: unknown, where: string): boolean | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'boolean')
    throw new Error(`pr-review-guide.yaml: map: ${where} must be true or false`)
  return value
}

/** Throws when a name repeats an earlier one or takes the name the map keeps for itself. */
function checkNames(names: string[], kind: string, reserved: string) {
  names.forEach((name, i) => {
    if (name === reserved || names.indexOf(name) < i) {
      throw new Error(`pr-review-guide.yaml: map: ${kind}[${i}].name "${name}" is taken`)
    }
  })
}

/** The map configuration from YAML text, checked; an error names the faulty field. */
export function parseMapConfig(source: string): MapConfig {
  return mapConfigOf(parse(source))
}

/** The map configuration from the settings file's `map` part, checked. */
export function mapConfigOf(value: unknown): MapConfig {
  const top = mapping(value, '', TOP_KEYS)

  const layers = list(top.layers, 'layers').map((entry, i): LayerConfig => {
    const where = `layers[${i}]`
    const row = mapping(entry, where, LAYER_KEYS)
    const layer: LayerConfig = { name: text(row.name, `${where}.name`) }
    if (row.group !== undefined) {
      if (typeof row.group !== 'string' || !GROUPS.has(row.group)) {
        throw new Error(`pr-review-guide.yaml: map: ${where}.group must be "ui"`)
      }
      layer.group = 'ui'
    }
    if (flag(row.side, `${where}.side`)) layer.side = true
    if (flag(row.wholeSlice, `${where}.wholeSlice`)) layer.wholeSlice = true
    return layer
  })
  checkNames(
    layers.map((l) => l.name),
    'layers',
    UNPLACED,
  )
  if (layers.filter((l) => l.side).length > 1) {
    throw new Error('pr-review-guide.yaml: map: at most one layer can have side: true')
  }

  const strips = list(top.strips, 'strips').map((entry, i): StripConfig => {
    const where = `strips[${i}]`
    const row = mapping(entry, where, STRIP_KEYS)
    if (!isStringList(row.paths)) {
      throw new Error(`pr-review-guide.yaml: map: ${where}.paths must be a list of globs`)
    }
    return { name: text(row.name, `${where}.name`), paths: row.paths }
  })
  checkNames(
    strips.map((s) => s.name),
    'strips',
    OTHER_STRIP,
  )

  if (!isStringList(top.offMap)) {
    throw new Error('pr-review-guide.yaml: map: offMap must be a list of globs')
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

/**
 * `context`: an unchanged file that an added or removed import points at. `importer`: an
 * unchanged file that uses a changed export.
 */
export type MapStatus =
  'added' | 'changed' | 'deleted' | 'moved' | 'ghost' | 'context' | 'importer'

export interface MapFile {
  path: string
  status: MapStatus
  /** The old path of a moved file. */
  from?: string
  /** The new path, on the ghost a moved file leaves at its old place. */
  movedTo?: string
  /** On a context file that also uses a changed export. */
  importer?: true
  /** A changed file's exports, the changed ones marked. */
  exports?: ExportInfo[]
  /** How many unchanged files use the file's changed exports, on the map or not; never 0. */
  reach?: number
  /** An importer's leading doc comment. */
  doc?: string
}

/** An unchanged file using changed exports of a changed file. */
export interface UseEdge {
  from: string
  to: string
  names: string[]
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
  /** The re-exported names the barrels directly in this folder added and removed. */
  api?: { added: number; removed: number }
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
  /** The import edges from the files on the map, or why they could not be read. */
  imports: MapImports
}

export type MapImports = Section<{ edges: ImportChange[]; uses: UseEdge[] }>

/** What the map reads from the code: the import edges, and the export facts when known. */
export type MapCode = Pick<CodeChanges, 'edges'> & Partial<Omit<CodeChanges, 'edges'>>

/** A slice with more changed files than this starts collapsed. */
export const COLLAPSE_ABOVE = 4
const ROOT_SLICE = '(root)'

const STATUS: Record<ChangedFile['status'], MapStatus> = {
  added: 'added',
  modified: 'changed',
  deleted: 'deleted',
  renamed: 'moved',
}

// A moved file leaves a ghost at its old place only when both places are on the map, so a
// rename into or out of the off-map files is counted or drawn once.
function mapFiles(files: ChangedFile[], config: MapConfig): MapFile[] {
  const off = (path: string) => placeFile(path, config).kind === 'off'
  return files.flatMap((f): MapFile[] => {
    if (f.status !== 'renamed' || !f.oldPath)
      return [{ path: f.path, status: STATUS[f.status] }]
    const moved: MapFile = { path: f.path, status: 'moved', from: f.oldPath }
    return off(f.path) || off(f.oldPath)
      ? [moved]
      : [moved, { path: f.oldPath, status: 'ghost', movedTo: f.path }]
  })
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
function finish(
  raw: RawFolder,
  depth: number,
  sliceDepth: number | undefined,
  api: Map<string, { added: number; removed: number }>,
): Folder {
  let folder = raw
  let label = raw.name
  // A folded folder's barrels still count, on the folder that stands for the chain.
  const chain = [raw.path]
  while (depth > 0 && folder.files.length === 0 && folder.sub.size === 1) {
    folder = [...folder.sub.values()][0] as RawFolder
    label += `/${folder.name}`
    chain.push(folder.path)
  }
  const sums = chain.flatMap((path) => api.get(path) ?? [])
  const chip = sums.length
    ? {
        added: sums.reduce((n, a) => n + a.added, 0),
        removed: sums.reduce((n, a) => n + a.removed, 0),
      }
    : undefined
  const folders = [...folder.sub.values()]
    .map((f) => finish(f, depth + 1, sliceDepth, api))
    .sort(byName((f) => f.label))
  const files = [...folder.files].sort(byName((f) => f.path))
  const changed =
    files.filter(
      (f) => f.status !== 'ghost' && f.status !== 'context' && f.status !== 'importer',
    ).length + folders.reduce((sum, f) => sum + f.changed, 0)
  const total = files.length + folders.reduce((sum, f) => sum + count(f), 0)
  return {
    path: folder.path,
    label,
    files,
    folders,
    changed,
    startsCollapsed: depth === sliceDepth && changed > COLLAPSE_ABOVE,
    collapsible: total > 1,
    ...(chip ? { api: chip } : {}),
  }
}

const count = (f: Folder): number =>
  f.files.length + f.folders.reduce((sum, sub) => sum + count(sub), 0)

/** The map of a branch's changed files, placed by the configuration. */
export function buildChangesetMap(
  changed: ChangedFile[],
  config: MapConfig,
  code: Section<MapCode> = { status: 'ok', edges: [] },
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

  const files = mapFiles(changed, config)
  const boxes = new Set(files.filter((f) => f.status !== 'ghost').map((f) => f.path))
  const onMap = (path: string) => {
    const kind = placeFile(path, config).kind
    return kind === 'layer' || kind === 'unplaced'
  }
  const changedPaths = new Set(boxes)
  const uses: UseEdge[] = []
  if (code.status === 'ok') {
    for (const edge of code.edges) {
      if (edge.status === 'kept') continue
      for (const path of [edge.from, edge.to]) {
        if (boxes.has(path) || !onMap(path)) continue
        boxes.add(path)
        files.push({ path, status: 'context' })
      }
    }
    // Tests and the other off-map files never count as importers, not even in the reach.
    const off = (path: string) => placeFile(path, config).kind === 'off'
    uses.push(...usesOf(code, changedPaths).filter((u) => !off(u.from)))
    addImporters(files, boxes, uses, code.docs ?? {}, onMap)
    addExports(files, code.exports ?? {}, uses)
  }

  for (const file of files) {
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

  const api = apiByFolder(code.status === 'ok' ? (code.barrels ?? {}) : {}, config, roots)
  const layers: LayerView[] = config.layers.map((l) => ({
    name: l.name,
    ...(l.group ? { group: l.group } : {}),
    ...(l.side ? { side: true } : {}),
    root: finish(roots.get(l.name) as RawFolder, 0, l.wholeSlice ? undefined : 1, api),
  }))
  if (unplaced.files.length > 0 || unplaced.sub.size > 0) {
    layers.push({ name: UNPLACED, root: finish(unplaced, 0, undefined, api) })
  }
  return {
    layers,
    strips: [...strips]
      .filter(([, files]) => files.length > 0)
      .map(([name, files]) => ({ name, files: files.sort(byName((f) => f.path)) })),
    offMap,
    imports:
      code.status === 'ok'
        ? {
            status: 'ok',
            edges: code.edges.filter((e) => boxes.has(e.from) && onMap(e.from)),
            uses,
          }
        : code,
  }
}

/**
 * Each unchanged file's use of a changed file's changed exports. A name the file only
 * re-exports is not a use, and a namespace used as a whole (`*`) uses every export.
 */
function usesOf(code: MapCode, changed: Set<string>): UseEdge[] {
  const uses: UseEdge[] = []
  for (const edge of code.edges) {
    if (edge.status === 'removed' || changed.has(edge.from) || !changed.has(edge.to))
      continue
    const changedNames = new Set(
      (code.exports?.[edge.to] ?? [])
        .filter((x) => x.change === 'changed')
        .map((x) => x.name),
    )
    if (changedNames.size === 0) continue
    const own = edge.names.filter((n) => !edge.reexports?.includes(n))
    const names = own.filter((n) => n === '*' || changedNames.has(n))
    if (names.length > 0) uses.push({ from: edge.from, to: edge.to, names })
  }
  return uses
}

/** Places the importers on the map: a box of their own, or a mark on a context box. */
function addImporters(
  files: MapFile[],
  boxes: Set<string>,
  uses: UseEdge[],
  docs: Record<string, string>,
  onMap: (path: string) => boolean,
) {
  for (const path of new Set(uses.map((u) => u.from))) {
    if (!onMap(path)) continue
    const doc = docs[path]
    const known = files.find((f) => f.path === path)
    if (known) {
      known.importer = true
      if (doc) known.doc = doc
      continue
    }
    boxes.add(path)
    files.push({ path, status: 'importer', ...(doc ? { doc } : {}) })
  }
}

/** Gives each changed file its exports and how many unchanged files use them. */
function addExports(
  files: MapFile[],
  exports: Record<string, ExportInfo[]>,
  uses: UseEdge[],
) {
  for (const file of files) {
    if (
      file.status === 'ghost' ||
      file.status === 'context' ||
      file.status === 'importer'
    )
      continue
    const list = exports[file.path]
    if (list?.length) file.exports = list
    const reach = new Set(uses.filter((u) => u.to === file.path).map((u) => u.from)).size
    if (reach > 0) file.reach = reach
  }
}

/** The barrels' added and removed re-exports, summed per folder the map draws them in. */
function apiByFolder(
  barrels: Record<string, { added: string[]; removed: string[] }>,
  config: MapConfig,
  roots: Map<string, RawFolder>,
): Map<string, { added: number; removed: number }> {
  const api = new Map<string, { added: number; removed: number }>()
  for (const [path, diff] of Object.entries(barrels)) {
    const place = placeFile(path, config)
    let folder = path.slice(0, path.lastIndexOf('/'))
    if (place.kind === 'layer' && folder === roots.get(place.layer)?.path)
      folder = `${folder}/${ROOT_SLICE}`
    const sum = api.get(folder) ?? { added: 0, removed: 0 }
    sum.added += diff.added.length
    sum.removed += diff.removed.length
    api.set(folder, sum)
  }
  return api
}

/**
 * The map, or why it is not available: missing or invalid map settings, or a
 * failing read of the changed files. Either way only the map is lost, not the guide.
 */
export function readChangesetMap(
  readChanged: () => ChangedFile[],
  mapSettings: unknown,
  readCode: (changed: ChangedFile[]) => MapCode = () => ({ edges: [] }),
): Section<ChangesetMap> {
  const notAvailable = (reason: string) => ({ status: 'not available' as const, reason })
  const message = (error: unknown) =>
    error instanceof Error ? error.message : String(error)
  if (mapSettings === undefined)
    return notAvailable('pr-review-guide.yaml has no map settings')
  let config: MapConfig
  try {
    config = mapConfigOf(mapSettings)
  } catch (error) {
    return notAvailable(message(error))
  }
  let changed: ChangedFile[]
  try {
    changed = readChanged()
  } catch (error) {
    return notAvailable(`reading the changed files failed: ${message(error)}`)
  }
  let code: Section<MapCode>
  try {
    code = { status: 'ok', ...readCode(changed) }
  } catch (error) {
    code = notAvailable(`reading the imports failed: ${message(error)}`)
  }
  return { status: 'ok', ...buildChangesetMap(changed, config, code) }
}
