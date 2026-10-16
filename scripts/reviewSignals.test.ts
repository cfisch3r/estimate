// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import type { ChangedFile, Diff } from './changedDiff.ts'
import {
  coverageSignal,
  dependenciesSignal,
  dependencyChanges,
  historyOf,
  historySignal,
  lockfileEntries,
  metricsSignal,
  relevantAdvisories,
  uncoveredLines,
  type CoverageReport,
} from './reviewSignals.ts'

// The signals are evidence for the risk-review agent. Each section must degrade to
// "not available" instead of throwing, and must report only what it measured.
interface Change {
  path: string
  status?: ChangedFile['status']
  before?: string
  after?: string
  added?: string[]
  lines?: number[]
}

function diffOf(...changes: Change[]): Diff {
  const byPath = new Map(changes.map((c) => [c.path, c]))
  return {
    files: changes.map((c) => ({ path: c.path, status: c.status ?? 'modified' })),
    before: (path) => byPath.get(path)?.before,
    after: (path) => byPath.get(path)?.after,
    addedLines: (file) => byPath.get(file.path)?.added ?? [],
    addedLineNumbers: (file) => byPath.get(file.path)?.lines ?? [],
  }
}

describe('history', () => {
  it('counts commits and fix commits, including scoped and breaking fixes', () => {
    expect(
      historyOf('a.ts', [
        'fix: a',
        'fix(net): b',
        'fix!: c',
        'feat: d',
        'chore: fix typo',
      ]),
    ).toEqual({ path: 'a.ts', changes: 5, fixes: 3 })
  })

  it('ranks by fixes, then changes, and leaves out new files and unchanged history', () => {
    const subjects: Record<string, string[]> = {
      'a.ts': ['feat: x', 'feat: y', 'feat: z'],
      'b.ts': ['fix: x'],
      'c.ts': [],
    }
    const result = historySignal(
      [
        { path: 'a.ts', status: 'modified' },
        { path: 'b.ts', status: 'modified' },
        { path: 'c.ts', status: 'modified' },
        { path: 'new.ts', status: 'added' },
      ],
      (path) => subjects[path] ?? [],
    )
    expect(result).toMatchObject({ status: 'ok' })
    expect(result.status === 'ok' && result.files.map((f) => f.path)).toEqual([
      'b.ts',
      'a.ts',
    ])
  })

  it('reads the history of the old path for a rename', () => {
    const seen: string[] = []
    historySignal([{ path: 'new.ts', oldPath: 'old.ts', status: 'renamed' }], (path) => {
      seen.push(path)
      return []
    })
    expect(seen).toEqual(['old.ts'])
  })

  it('is not available when git fails', () => {
    const result = historySignal([{ path: 'a.ts', status: 'modified' }], () => {
      throw new Error('git broke\nmore')
    })
    expect(result).toEqual({ status: 'not available', reason: 'git broke' })
  })
})

describe('metrics', () => {
  it('keeps the printed items and drops the script header and blank lines', () => {
    expect(
      metricsSignal(() => '$ node scripts/metrics.mjs\n\n  src/a.ts: big\n'),
    ).toEqual({
      status: 'ok',
      items: ['src/a.ts: big'],
    })
  })

  it('is not available when the script fails', () => {
    expect(
      metricsSignal(() => {
        throw new Error('no main')
      }),
    ).toEqual({ status: 'not available', reason: 'no main' })
  })
})

describe('changed-line coverage', () => {
  const file = {
    statementMap: {
      '0': { start: { line: 1 } },
      '1': { start: { line: 5 } },
      '2': { start: { line: 5 } },
      '3': { start: { line: 9 } },
    },
    s: { '0': 2, '1': 0, '2': 3, '3': 0 },
  }

  it('reports changed lines where a statement starting there never ran', () => {
    expect(uncoveredLines(file, [1, 5, 9, 20])).toEqual([5, 9])
  })

  it('ignores uncovered lines that were not changed', () => {
    expect(uncoveredLines(file, [1])).toEqual([])
  })

  const cwd = '/repo'
  const report: CoverageReport = { '/repo/src/domain/a.ts': file }

  it('reports file:line for changed source files and lists files missing from the report', () => {
    const diff = diffOf(
      { path: 'src/domain/a.ts', lines: [5, 9] },
      { path: 'src/domain/b.ts', lines: [1] },
      { path: 'src/domain/a.test.ts', lines: [1] },
      { path: 'docs/x.md', lines: [1] },
      { path: 'src/domain/gone.ts', status: 'deleted' },
    )
    expect(coverageSignal(diff, () => report, cwd)).toEqual({
      status: 'ok',
      checkedFiles: 2,
      uncovered: ['src/domain/a.ts:5', 'src/domain/a.ts:9'],
      notInReport: ['src/domain/b.ts'],
    })
  })

  it('does not run the tests when no source file changed', () => {
    const read = vi.fn(() => report)
    expect(coverageSignal(diffOf({ path: 'docs/x.md' }), read, cwd)).toMatchObject({
      status: 'ok',
      checkedFiles: 0,
    })
    expect(read).not.toHaveBeenCalled()
  })

  it('is not available when the run fails', () => {
    const diff = diffOf({ path: 'src/domain/a.ts', lines: [1] })
    expect(
      coverageSignal(
        diff,
        () => {
          throw new Error('the coverage run took longer than 120s')
        },
        cwd,
      ),
    ).toEqual({
      status: 'not available',
      reason: 'the coverage run took longer than 120s',
    })
  })
})

describe('dependencies', () => {
  const pkg = (deps: Record<string, string>, dev: Record<string, string> = {}) =>
    JSON.stringify({ version: '1.0.0', dependencies: deps, devDependencies: dev })

  it('lists added, removed and changed direct dependencies', () => {
    expect(
      dependencyChanges(
        pkg({ react: '^19.0.0', zustand: '^5.0.0' }, { vitest: '^4.0.0' }),
        pkg({ react: '^19.1.0', marked: '^18.0.0' }, { vitest: '^4.0.0' }),
      ),
    ).toEqual([
      { name: 'marked', from: null, to: '^18.0.0' },
      { name: 'react', from: '^19.0.0', to: '^19.1.0' },
      { name: 'zustand', from: '^5.0.0', to: null },
    ])
  })

  it('finds the package and version entries a lockfile change added', () => {
    expect(
      lockfileEntries([
        '  yaml@2.9.1:',
        "  '@scope/pkg@1.2.3':",
        '  react-dom@19.2.8(react@19.2.8):',
        '    resolution: {integrity: sha512-x}',
        '      yaml: 2.9.1',
      ]),
    ).toEqual(['@scope/pkg@1.2.3', 'react-dom@19.2.8', 'yaml@2.9.1'])
  })

  const audit = {
    advisories: {
      '1': {
        github_advisory_id: 'GHSA-1',
        module_name: 'yaml',
        severity: 'high',
        title: 'bad yaml',
        findings: [{ version: '2.9.1' }, { version: '1.0.0' }],
      },
      '2': {
        github_advisory_id: 'GHSA-2',
        module_name: 'other',
        severity: 'low',
        title: 'old problem',
        findings: [{ version: '3.0.0' }],
      },
    },
  }

  it('keeps only advisories that hit a version the change added', () => {
    expect(relevantAdvisories(audit, ['yaml@2.9.1', 'other@4.0.0'])).toEqual([
      {
        id: 'GHSA-1',
        module: 'yaml',
        version: '2.9.1',
        severity: 'high',
        title: 'bad yaml',
      },
    ])
    expect(relevantAdvisories({}, ['yaml@2.9.1'])).toEqual([])
  })

  it('combines the diff and the audit', () => {
    const diff = diffOf(
      { path: 'package.json', before: pkg({}), after: pkg({ yaml: '^2.9.1' }) },
      { path: 'pnpm-lock.yaml', added: ['  yaml@2.9.1:'] },
    )
    expect(dependenciesSignal(diff, () => audit)).toEqual({
      status: 'ok',
      changed: [{ name: 'yaml', from: null, to: '^2.9.1' }],
      lockfileEntries: ['yaml@2.9.1'],
      advisories: {
        status: 'ok',
        items: [
          {
            id: 'GHSA-1',
            module: 'yaml',
            version: '2.9.1',
            severity: 'high',
            title: 'bad yaml',
          },
        ],
      },
    })
  })

  it('does not run the audit without a dependency change', () => {
    const run = vi.fn(() => audit)
    const diff = diffOf({ path: 'package.json', before: pkg({}), after: pkg({}) })
    expect(dependenciesSignal(diff, run)).toMatchObject({ status: 'ok', changed: [] })
    expect(run).not.toHaveBeenCalled()
  })

  it('keeps the diff when only the audit is not available', () => {
    const diff = diffOf({
      path: 'package.json',
      before: pkg({}),
      after: pkg({ yaml: '^2.9.1' }),
    })
    const result = dependenciesSignal(diff, () => {
      throw new Error('pnpm audit gave no report (offline or timed out)')
    })
    expect(result).toMatchObject({
      status: 'ok',
      changed: [{ name: 'yaml' }],
      advisories: { status: 'not available' },
    })
  })
})
