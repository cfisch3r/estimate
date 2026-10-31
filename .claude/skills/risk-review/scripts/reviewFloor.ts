import { matchesGlob } from 'node:path'
import { parse } from 'yaml'
import {
  baseRef,
  readGitDiff,
  repoRoot,
  showAt,
  type ChangedFile,
  type Diff,
} from './changedDiff.ts'

// The review floor: the minimum risk of a change, set by the catalogue in
// docs/review-risk.md. No model, no coverage run, no network. The `risk-review:reviewer` agent may
// raise the result and never lower it.
//
//   pnpm review:floor              the branch against main
//   pnpm review:floor <commit>     only what changed since <commit>
//
// Prints JSON: { base, since, floor, categories: [{ name, minRisk, files, diffChecks }],
// changedFiles, changedLines }.

export const RISK_LEVELS = ['low', 'medium', 'high', 'critical'] as const
export type RiskLevel = (typeof RISK_LEVELS)[number]

const CATALOGUE_PATH = 'docs/review-risk.md'

/** Each diff check returns the changed files that make it true. */
const DIFF_CHECKS = {
  coverageThresholdLowered,
  testsRemovedOrSkipped,
  strictnessLoosened,
  dependencyFieldsChanged,
  pureRename,
  architectureExceptionAdded,
}
export type DiffCheckName = keyof typeof DIFF_CHECKS

export interface Category {
  name: string
  minRisk: RiskLevel
  paths: string[]
  diffChecks: DiffCheckName[]
  fallback: boolean
}

export interface MatchedCategory {
  name: string
  minRisk: RiskLevel
  files: string[]
  diffChecks: DiffCheckName[]
}

export interface Floor {
  floor: RiskLevel
  categories: MatchedCategory[]
  /** Every changed file, so a later step can tell whether a path is part of the change. */
  changedFiles: string[]
  /** For each changed file that still exists, the lines the change added or changed. */
  changedLines: Record<string, number[]>
}

const KEYS = new Set(['name', 'min-risk', 'paths', 'diff-checks', 'fallback'])

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string')
}

/** Reads the one fenced `yaml` block of the catalogue and checks every entry. */
export function parseCatalogue(markdown: string): Category[] {
  const blocks = [...markdown.matchAll(/^```yaml\n([\s\S]*?)^```/gm)]
  if (blocks.length !== 1) {
    throw new Error(`${CATALOGUE_PATH}: expected one yaml block, found ${blocks.length}`)
  }
  const data: unknown = parse(blocks[0]?.[1] ?? '')
  if (!Array.isArray(data))
    throw new Error(`${CATALOGUE_PATH}: the yaml block is not a list`)

  const names = new Set<string>()
  const categories = data.map((entry: unknown, index): Category => {
    const where = `${CATALOGUE_PATH}: entry ${index + 1}`
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      throw new Error(`${where} is not a mapping`)
    }
    const row = entry as Record<string, unknown>
    for (const key of Object.keys(row)) {
      if (!KEYS.has(key)) throw new Error(`${where}: unknown key "${key}"`)
    }
    const { name, paths } = row
    if (typeof name !== 'string' || !/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(name)) {
      throw new Error(`${where}: name must be kebab-case`)
    }
    if (names.has(name)) throw new Error(`${where}: duplicate name "${name}"`)
    names.add(name)
    const minRisk = row['min-risk']
    if (!RISK_LEVELS.includes(minRisk as RiskLevel)) {
      throw new Error(`${where} (${name}): missing or unknown min-risk`)
    }
    if (!isStringArray(paths)) throw new Error(`${where} (${name}): paths must be a list`)
    const checks = row['diff-checks'] ?? []
    if (!isStringArray(checks)) {
      throw new Error(`${where} (${name}): diff-checks must be a list`)
    }
    for (const check of checks) {
      if (!Object.hasOwn(DIFF_CHECKS, check)) {
        throw new Error(`${where} (${name}): unknown diff check "${check}"`)
      }
    }
    const fallback = row.fallback ?? false
    if (typeof fallback !== 'boolean') {
      throw new Error(`${where} (${name}): fallback must be true or false`)
    }
    return {
      name,
      minRisk: minRisk as RiskLevel,
      paths,
      diffChecks: checks as DiffCheckName[],
      fallback,
    }
  })
  if (categories.filter((c) => c.fallback).length > 1) {
    throw new Error(`${CATALOGUE_PATH}: at most one category can be the fallback`)
  }
  return categories
}

const matchesAny = (path: string, globs: string[]) =>
  globs.some((g) => matchesGlob(path, g))

// A test file belongs to the category of the file it tests: same directory, `.test`
// before the extension.
function testedFile(path: string): string[] {
  const match = /^(.*)\.test\.(tsx?)$/.exec(path)
  return match ? [`${match[1]}.ts`, `${match[1]}.tsx`] : []
}

function fileMatches(file: ChangedFile, globs: string[]): boolean {
  const paths = [
    file.path,
    ...(file.oldPath ? [file.oldPath] : []),
    ...testedFile(file.path),
  ]
  return paths.some((p) => matchesAny(p, globs))
}

const isTestFile = (path: string) => /\.(test|spec)\.[cm]?[jt]sx?$/.test(path)

function coverageThresholdLowered(diff: Diff): string[] {
  const read = (text: string | undefined) => {
    const found: Record<string, number[]> = {}
    for (const m of (text ?? '').matchAll(
      /\b(statements|branches|functions|lines)\s*:\s*(\d+)/g,
    )) {
      const key = m[1] ?? ''
      ;(found[key] ??= []).push(Number(m[2]))
    }
    return found
  }
  return diff.files
    .filter((f) => f.path === 'vite.config.ts')
    .filter((f) => {
      const before = read(diff.before(f.oldPath ?? f.path))
      const after = read(diff.after(f.path))
      return Object.entries(before).some(([key, numbers]) =>
        numbers.some((n, i) => (after[key]?.[i] ?? -1) < n),
      )
    })
    .map((f) => f.path)
}

// A call at the start of a line, so a string that merely mentions `it.skip(` (as the
// tests of this script do) is not taken for a skipped test.
const SKIP_CALL =
  /^\s*((it|test|describe)(\.\w+)*\.(skip\w*|only|todo)\b|xit\(|xdescribe\()/

function testsRemovedOrSkipped(diff: Diff): string[] {
  return diff.files
    .filter((f) => {
      if (f.status === 'deleted') return isTestFile(f.path)
      if (!isTestFile(f.path)) return false
      return diff.addedLines(f).some((line) => SKIP_CALL.test(line))
    })
    .map((f) => f.path)
}

// An exception comment at the start of a line (`//`, `/*`, JSX `{/*` or a block
// comment's ` *` line), so a string that merely mentions one is not
// taken for an exception. Each one excuses an architecture rule at the code.
const EXCEPTION_COMMENT = /^\s*(\/\/|\{?\/\*|\*)\s*architecture-exception:/

function architectureExceptionAdded(diff: Diff): string[] {
  return diff.files
    .filter((f) => f.status !== 'deleted')
    .filter((f) => diff.addedLines(f).some((line) => EXCEPTION_COMMENT.test(line)))
    .map((f) => f.path)
}

const STRICT_FLAG =
  /"(strict\w*|alwaysStrict|noImplicit\w+|noUnchecked\w+|noUnused\w+|noFallthroughCasesInSwitch|noPropertyAccessFromIndexSignature|exactOptionalPropertyTypes|useUnknownInCatchVariables|erasableSyntaxOnly)"\s*:\s*(true|false)/g

function strictnessLoosened(diff: Diff): string[] {
  const read = (text: string | undefined) =>
    new Map([...(text ?? '').matchAll(STRICT_FLAG)].map((m) => [m[1], m[2] === 'true']))
  return diff.files
    .filter((f) => /(^|\/)tsconfig[^/]*\.json$/.test(f.path))
    .filter((f) => {
      const before = read(diff.before(f.oldPath ?? f.path))
      const after = read(diff.after(f.path))
      return [...before].some(([flag, wasOn]) => wasOn && after.get(flag) !== true)
    })
    .map((f) => f.path)
}

const DEPENDENCY_FIELDS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
  'overrides',
]

function dependencyFieldsChanged(diff: Diff): string[] {
  const read = (text: string | undefined) => {
    const json = text ? (JSON.parse(text) as Record<string, unknown>) : {}
    return JSON.stringify(DEPENDENCY_FIELDS.map((field) => json[field] ?? null))
  }
  return diff.files
    .filter((f) => f.path === 'package.json')
    .filter((f) => read(diff.before(f.path)) !== read(diff.after(f.path)))
    .map((f) => f.path)
}

function pureRename(diff: Diff): string[] {
  return diff.files
    .filter((f) => f.status === 'renamed' && f.similarity === 100)
    .map((f) => f.path)
}

const higher = (a: RiskLevel, b: RiskLevel) =>
  RISK_LEVELS.indexOf(a) >= RISK_LEVELS.indexOf(b) ? a : b

/** Matches the changed files against the catalogue and returns the floor. */
export function evaluateFloor(catalogue: Category[], diff: Diff): Floor {
  const checkHits = new Map<DiffCheckName, string[]>(
    (Object.keys(DIFF_CHECKS) as DiffCheckName[]).map((name) => [
      name,
      DIFF_CHECKS[name](diff),
    ]),
  )
  const hitsOf = (category: Category) =>
    category.diffChecks.filter((name) => (checkHits.get(name) ?? []).length > 0)

  const matched: MatchedCategory[] = []
  for (const category of catalogue.filter((c) => !c.fallback)) {
    const files = diff.files
      .filter((f) => fileMatches(f, category.paths))
      .map((f) => f.path)
    const diffChecks = hitsOf(category)
    if (files.length > 0 || diffChecks.length > 0) {
      const checkFiles = diffChecks.flatMap((name) => checkHits.get(name) ?? [])
      matched.push({
        name: category.name,
        minRisk: category.minRisk,
        files: [...new Set([...files, ...checkFiles])],
        diffChecks,
      })
    }
  }

  const fallback = catalogue.find((c) => c.fallback)
  if (fallback && matched.length === 0 && diff.files.length > 0) {
    const renamed = new Set(
      fallback.diffChecks.flatMap((name) => checkHits.get(name) ?? []),
    )
    const covered = diff.files.every(
      (f) => fileMatches(f, fallback.paths) || renamed.has(f.path),
    )
    if (covered) {
      matched.push({
        name: fallback.name,
        minRisk: fallback.minRisk,
        files: diff.files.map((f) => f.path),
        diffChecks: hitsOf(fallback),
      })
    }
  }

  return {
    floor: matched.reduce<RiskLevel>((acc, m) => higher(acc, m.minRisk), 'low'),
    categories: matched,
    changedFiles: diff.files.map((f) => f.path),
    changedLines: Object.fromEntries(
      diff.files
        .filter((f) => f.status !== 'deleted')
        .map((f) => [f.path, diff.addedLineNumbers(f)]),
    ),
  }
}

/** The floor of the working tree against the base branch, or against `since` (a commit). */
export function readFloor(options: { cwd?: string; since?: string } = {}) {
  const cwd = options.cwd ?? repoRoot()
  const { since } = options
  if (since?.startsWith('-')) throw new Error(`Expected a commit, got "${since}"`)
  const base = baseRef(cwd)
  const catalogue = parseCatalogue(showAt(base, CATALOGUE_PATH, cwd))
  const diff = readGitDiff(since ? { cwd, from: since } : { cwd })
  return { base, since: since ?? null, ...evaluateFloor(catalogue, diff) }
}

function main() {
  console.log(JSON.stringify(readFloor({ since: process.argv[2] }), null, 2))
}

if (process.argv[1] === import.meta.filename) {
  try {
    main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
