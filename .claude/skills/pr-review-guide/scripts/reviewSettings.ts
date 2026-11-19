import { parse } from 'yaml'
import { fileAt } from './changedDiff.ts'

// The project's settings for the plugin, in one file at the repository root: where the
// catalogue is and how the changeset map is laid out. The plugin itself holds no project
// paths. The file is read from the base branch, like the catalogue: it says which catalogue
// sets the floor, so a pull request must not be able to point its own floor elsewhere.

export const SETTINGS_PATH = 'pr-review-guide.yaml'

/** The catalogue a project without settings file uses. */
export const DEFAULT_CATALOGUE = 'docs/technical/pr-review-catalogue.md'

export interface Settings {
  /** The catalogue's path from the repository root. */
  catalogue: string
  /** The changeset map's settings as written; `reviewMap.ts` checks them. */
  map: unknown
  /** Whether the base branch has a settings file, or the defaults apply. */
  fromFile: boolean
}

const KEYS = new Set(['catalogue', 'map'])

/** The settings, checked; an error names the faulty key. */
export function parseSettings(source: string): Settings {
  const data: unknown = parse(source)
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new Error(`${SETTINGS_PATH}: the file is not a mapping`)
  }
  const top = data as Record<string, unknown>
  for (const key of Object.keys(top)) {
    if (!KEYS.has(key)) throw new Error(`${SETTINGS_PATH}: unknown key "${key}"`)
  }
  const catalogue = 'catalogue' in top ? top.catalogue : DEFAULT_CATALOGUE
  if (typeof catalogue !== 'string' || catalogue.trim() === '') {
    throw new Error(`${SETTINGS_PATH}: catalogue must be a path`)
  }
  return { catalogue, map: top.map, fromFile: true }
}

/**
 * The settings at `base`, by their exact path: the file's name is fixed, so a rename from
 * another file is never followed. Without the file, the defaults apply; a malformed file
 * throws, so a broken file on the base branch stops the floor instead of lowering it.
 */
export function readSettings(base: string, cwd: string): Settings {
  const source = fileAt(base, SETTINGS_PATH, cwd)
  return source === undefined
    ? { catalogue: DEFAULT_CATALOGUE, map: undefined, fromFile: false }
    : parseSettings(source)
}
