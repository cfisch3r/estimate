import { parse } from 'yaml'
import { matchesPattern } from './reviewFloor.ts'

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
