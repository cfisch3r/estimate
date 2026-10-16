import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  baseRef,
  readGitDiff,
  repoRoot,
  type ChangedFile,
  type Diff,
} from './changedDiff.ts'

// Evidence for the `risk-review` agent: git history, advisory hotspots, changed-line
// coverage and the dependency diff. A signal only shapes where the agent looks; it never
// sets a category or the floor. Every section reports `ok` or `not available` (with the
// reason) and nothing here can fail the run, so a missing tool never blocks a pull request.
//
//   pnpm review:signals
//
// Prints JSON: { base, history, metrics, coverage, dependencies }.

export type Section<T> =
  ({ status: 'ok' } & T) | { status: 'not available'; reason: string }

const unavailable = (error: unknown): { status: 'not available'; reason: string } => ({
  status: 'not available',
  reason:
    error instanceof Error ? (error.message.split('\n')[0] ?? 'failed') : String(error),
})

// --- history --------------------------------------------------------------------------

export interface FileHistory {
  path: string
  changes: number
  fixes: number
}

const FIX_SUBJECT = /^fix(\([^)]*\))?!?:/

/** Counts the commits and the `fix:` commits among a file's commit subjects. */
export function historyOf(path: string, subjects: string[]): FileHistory {
  return {
    path,
    changes: subjects.length,
    fixes: subjects.filter((s) => FIX_SUBJECT.test(s)).length,
  }
}

const HISTORY_ITEMS = 10

export function historySignal(
  files: ChangedFile[],
  subjectsOf: (path: string) => string[],
): Section<{ since: string; files: FileHistory[] }> {
  try {
    const items = files
      .filter((f) => f.status !== 'added' && f.status !== 'deleted')
      .map((f) => historyOf(f.path, subjectsOf(f.oldPath ?? f.path)))
      .filter((h) => h.changes > 0)
      .sort((a, b) => b.fixes - a.fixes || b.changes - a.changes)
    return { status: 'ok', since: '6 months', files: items.slice(0, HISTORY_ITEMS) }
  } catch (error) {
    return unavailable(error)
  }
}

// --- metrics --------------------------------------------------------------------------

/** The one-line items `pnpm metrics` prints for the files in the diff. */
export function metricsSignal(run: () => string): Section<{ items: string[] }> {
  try {
    const items = run()
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('$ '))
    return { status: 'ok', items }
  } catch (error) {
    return unavailable(error)
  }
}

// --- changed-line coverage ------------------------------------------------------------

interface FileCoverage {
  statementMap: Record<string, { start: { line: number } }>
  s: Record<string, number>
}
export type CoverageReport = Record<string, FileCoverage>

/** The lines among `lines` where a statement that starts on the line never ran. */
export function uncoveredLines(coverage: FileCoverage, lines: number[]): number[] {
  const wanted = new Set(lines)
  const uncovered = new Set<number>()
  for (const [id, statement] of Object.entries(coverage.statementMap)) {
    const line = statement.start.line
    if (wanted.has(line) && coverage.s[id] === 0) uncovered.add(line)
  }
  return [...uncovered].sort((a, b) => a - b)
}

const isSourceFile = (path: string) =>
  /^src\/.*\.tsx?$/.test(path) &&
  !/\.test\.tsx?$|testHelpers\.ts$|testFixtures\.ts$/.test(path)

export function coverageSignal(
  diff: Diff,
  readReport: () => CoverageReport,
  cwd: string,
): Section<{ checkedFiles: number; uncovered: string[]; notInReport: string[] }> {
  try {
    const files = diff.files.filter((f) => f.status !== 'deleted' && isSourceFile(f.path))
    const report = files.length > 0 ? readReport() : {}
    const uncovered: string[] = []
    const notInReport: string[] = []
    for (const file of files) {
      const coverage = report[join(cwd, file.path)]
      if (!coverage) {
        notInReport.push(file.path)
        continue
      }
      for (const line of uncoveredLines(coverage, diff.addedLineNumbers(file))) {
        uncovered.push(`${file.path}:${line}`)
      }
    }
    return { status: 'ok', checkedFiles: files.length, uncovered, notInReport }
  } catch (error) {
    return unavailable(error)
  }
}

/** Runs the unit tests with a JSON coverage report, within a time limit. */
export function runCoverage(cwd: string, timeoutMs: number): () => CoverageReport {
  return () => {
    const dir = mkdtempSync(join(tmpdir(), 'review-coverage-'))
    try {
      let cause = 'no error'
      try {
        execFileSync(
          'pnpm',
          [
            'exec',
            'vitest',
            'run',
            '--coverage',
            '--coverage.reporter=json',
            `--coverage.reportsDirectory=${dir}`,
          ],
          { cwd, timeout: timeoutMs, stdio: 'ignore' },
        )
      } catch (error) {
        // A failing test or a threshold still writes a report; a timeout or crash does not.
        if ((error as { code?: string }).code === 'ETIMEDOUT') {
          throw new Error(`the coverage run took longer than ${timeoutMs / 1000}s`, {
            cause: error,
          })
        }
        cause =
          error instanceof Error
            ? (error.message.split('\n')[0] ?? 'failed')
            : String(error)
      }
      try {
        return JSON.parse(
          readFileSync(join(dir, 'coverage-final.json'), 'utf8'),
        ) as CoverageReport
      } catch (error) {
        throw new Error(`the coverage run wrote no report (${cause})`, { cause: error })
      }
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }
}

// --- dependencies ---------------------------------------------------------------------

const DEPENDENCY_FIELDS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
]

export interface DependencyChange {
  field: string
  name: string
  from: string | null
  to: string | null
}

/** The direct dependencies whose version range was added, removed or changed. */
export function dependencyChanges(
  before: string | undefined,
  after: string | undefined,
): DependencyChange[] {
  const read = (text: string | undefined) => {
    const json = text
      ? (JSON.parse(text) as Record<string, Record<string, string> | undefined>)
      : {}
    return new Map(
      DEPENDENCY_FIELDS.flatMap((field) =>
        Object.entries(json[field] ?? {}).map(([name, range]) => [
          `${field}\0${name}`,
          range,
        ]),
      ),
    )
  }
  const was = read(before)
  const now = read(after)
  return [...new Set([...was.keys(), ...now.keys()])]
    .filter((key) => was.get(key) !== now.get(key))
    .sort(
      (a, b) => a.split('\0')[1]!.localeCompare(b.split('\0')[1]!) || a.localeCompare(b),
    )
    .map((key) => {
      const [field = '', name = ''] = key.split('\0')
      return { field, name, from: was.get(key) ?? null, to: now.get(key) ?? null }
    })
}

/** The `name@version` entries a change added to pnpm-lock.yaml. */
export function lockfileEntries(addedLines: string[]): string[] {
  const entries = new Set<string>()
  for (const line of addedLines) {
    const match = /^ {2}'?(@?[^@\s']+)@([^\s':(]+)[^:]*'?:\s*$/.exec(line)
    if (match) entries.add(`${match[1]}@${match[2]}`)
  }
  return [...entries].sort()
}

export interface Advisory {
  id: string
  module: string
  version: string
  severity: string
  title: string
}

interface AuditReport {
  advisories?: Record<
    string,
    {
      github_advisory_id: string
      module_name: string
      severity: string
      title: string
      findings: Array<{ version: string }>
    }
  >
}

/** The advisories from `pnpm audit` that hit a version this change added. */
export function relevantAdvisories(audit: AuditReport, entries: string[]): Advisory[] {
  const added = new Set(entries)
  return Object.values(audit.advisories ?? {}).flatMap((advisory) =>
    advisory.findings
      .filter((f) => added.has(`${advisory.module_name}@${f.version}`))
      .map((f) => ({
        id: advisory.github_advisory_id,
        module: advisory.module_name,
        version: f.version,
        severity: advisory.severity,
        title: advisory.title,
      })),
  )
}

export function dependenciesSignal(
  diff: Diff,
  audit: () => AuditReport,
): Section<{
  changed: DependencyChange[]
  lockfileEntries: string[]
  advisories: Section<{ items: Advisory[] }>
}> {
  try {
    const pkg = diff.files.find((f) => f.path === 'package.json')
    const lock = diff.files.find((f) => f.path === 'pnpm-lock.yaml')
    const changed = pkg
      ? dependencyChanges(diff.before('package.json'), diff.after('package.json'))
      : []
    const entries = lock ? lockfileEntries(diff.addedLines(lock)) : []
    if (changed.length === 0 && entries.length === 0) {
      return {
        status: 'ok',
        changed,
        lockfileEntries: entries,
        advisories: { status: 'ok', items: [] },
      }
    }
    let advisories: Section<{ items: Advisory[] }>
    try {
      advisories = { status: 'ok', items: relevantAdvisories(audit(), entries) }
    } catch (error) {
      advisories = unavailable(error)
    }
    return { status: 'ok', changed, lockfileEntries: entries, advisories }
  } catch (error) {
    return unavailable(error)
  }
}

/** `pnpm audit --json` exits non-zero when it finds something, so read stdout either way. */
export function runAudit(cwd: string, timeoutMs: number): () => AuditReport {
  return () => {
    let stdout: string
    try {
      stdout = execFileSync('pnpm', ['audit', '--json'], {
        cwd,
        timeout: timeoutMs,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'ignore'],
      })
    } catch (error) {
      stdout = String((error as { stdout?: string }).stdout ?? '')
    }
    try {
      return JSON.parse(stdout) as AuditReport
    } catch (error) {
      throw new Error('pnpm audit gave no report (offline or timed out)', {
        cause: error,
      })
    }
  }
}

// --- run ------------------------------------------------------------------------------

function main() {
  const cwd = repoRoot()
  const base = baseRef(cwd)
  const diff = readGitDiff({ cwd })
  const subjectsOf = (path: string) =>
    execFileSync(
      'git',
      ['log', base, '--since=6 months ago', '--format=%s', '--', path],
      {
        cwd,
        encoding: 'utf8',
      },
    )
      .split('\n')
      .filter(Boolean)

  const signals = {
    base,
    history: historySignal(diff.files, subjectsOf),
    metrics: metricsSignal(() =>
      execFileSync('pnpm', ['metrics'], {
        cwd,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }),
    ),
    coverage: coverageSignal(diff, runCoverage(cwd, 120_000), cwd),
    dependencies: dependenciesSignal(diff, runAudit(cwd, 60_000)),
  }
  console.log(JSON.stringify(signals, null, 2))
}

if (process.argv[1] === import.meta.filename) main()
