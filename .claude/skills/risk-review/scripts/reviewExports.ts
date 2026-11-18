import type { FileFacts, ProgramFacts } from './reviewImports.ts'

// Which exports a change adds, removes and changes, from the facts of the two programs. A
// declaration changed when its text (comments and layout left out) differs from the base;
// an export changed when its declaration changed or uses, in the same file and through any
// number of steps, a declaration that did.

export type ExportChangeKind = 'added' | 'removed' | 'changed'

export interface ExportInfo {
  name: string
  change?: ExportChangeKind
  /** The same-file declaration the export changed through, when its own did not change. */
  via?: string
}

export interface ExportDiff {
  /** The exports of each changed file, by its path now, sorted by name. */
  exports: Record<string, ExportInfo[]>
  /** The re-exported names each barrel added and removed; barrels without a change left out. */
  barrels: Record<string, { added: string[]; removed: string[] }>
}

const byName = (a: ExportInfo, b: ExportInfo) => a.name.localeCompare(b.name)

/** The nearest changed declaration `key` reaches, itself first; undefined when none. */
function changedThrough(
  key: string,
  head: FileFacts,
  base: FileFacts | undefined,
): string | undefined {
  const changed = (k: string) =>
    base?.declarations[k] === undefined ||
    base.declarations[k].text !== head.declarations[k]?.text
  const seen = new Set([key])
  const queue = [key]
  while (queue.length > 0) {
    const at = queue.shift() as string
    if (changed(at)) return at
    for (const dep of head.declarations[at]?.deps ?? []) {
      if (seen.has(dep)) continue
      seen.add(dep)
      queue.push(dep)
    }
  }
  return undefined
}

function exportsOf(
  head: FileFacts | undefined,
  base: FileFacts | undefined,
): ExportInfo[] {
  const now = head?.exports ?? {}
  const before = base?.exports ?? {}
  const list: ExportInfo[] = []
  for (const [name, key] of Object.entries(now)) {
    if (!(name in before)) list.push({ name, change: 'added' })
    else if (key === null || !head) list.push({ name })
    else {
      const through = changedThrough(key, head, base)
      if (through === undefined) list.push({ name })
      else if (through === key) list.push({ name, change: 'changed' })
      else list.push({ name, change: 'changed', via: through })
    }
  }
  for (const name of Object.keys(before))
    if (!(name in now)) list.push({ name, change: 'removed' })
  return list.sort(byName)
}

const reexported = (file: FileFacts | undefined) =>
  new Set(
    Object.entries(file?.exports ?? {})
      .filter(([, key]) => key === null)
      .map(([name]) => name),
  )

/** The export changes between the base and the head, with the base's paths moved first. */
export function diffExports(
  base: ProgramFacts,
  head: ProgramFacts,
  moves: Map<string, string>,
  changed: Set<string>,
): ExportDiff {
  const baseFiles: Record<string, FileFacts> = {}
  for (const [path, file] of Object.entries(base.files))
    baseFiles[moves.get(path) ?? path] = file

  const exports: ExportDiff['exports'] = {}
  for (const path of changed) {
    const now = head.files[path]
    const before = baseFiles[path]
    if (now || before) exports[path] = exportsOf(now, before)
  }

  // An `export *` changes a barrel's names without a change to the barrel, so every file
  // is compared, not only the changed ones.
  const barrels: ExportDiff['barrels'] = {}
  for (const path of new Set([...Object.keys(head.files), ...Object.keys(baseFiles)])) {
    const now = reexported(head.files[path])
    const before = reexported(baseFiles[path])
    const added = [...now].filter((n) => !before.has(n)).sort()
    const removed = [...before].filter((n) => !now.has(n)).sort()
    if (added.length || removed.length) barrels[path] = { added, removed }
  }
  return { exports, barrels }
}
