// @vitest-environment node
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import type { ChangedFile, Diff } from './changedDiff.ts'
import { readGitDiff } from './changedDiff.ts'
import { evaluateFloor, parseCatalogue, type Floor } from './reviewFloor.ts'

// The floor decides the minimum risk of a pull request, and the agent may never go below
// it. Each case plants one change and checks the category and the floor it produces, so a
// catalogue path or a diff check that stops working fails here instead of silently
// lowering the floor. The real catalogue is parsed too, so an edit that breaks the YAML
// block fails in CI.
const root = join(import.meta.dirname, '..')
const catalogue = parseCatalogue(readFileSync(join(root, 'docs/review-risk.md'), 'utf8'))

interface Change {
  path: string
  status?: ChangedFile['status']
  oldPath?: string
  similarity?: number
  before?: string
  after?: string
  added?: string[]
}

function diffOf(...changes: Change[]): Diff {
  const byPath = new Map(changes.map((c) => [c.path, c]))
  const files: ChangedFile[] = changes.map((c) => ({
    path: c.path,
    status: c.status ?? 'modified',
    ...(c.oldPath ? { oldPath: c.oldPath } : {}),
    ...(c.similarity === undefined ? {} : { similarity: c.similarity }),
  }))
  return {
    files,
    before: (path) => byPath.get(path)?.before,
    after: (path) => byPath.get(path)?.after,
    addedLines: (file) => byPath.get(file.path)?.added ?? [],
  }
}

const floorOf = (...changes: Change[]): Floor =>
  evaluateFloor(catalogue, diffOf(...changes))
const namesOf = (floor: Floor) => floor.categories.map((c) => c.name)

describe('paths', () => {
  it.each([
    ['domain-math', 'src/domain/estimate/estimate.ts', 'high'],
    ['live-session-state', 'src/application/stores/round.ts', 'high'],
    ['wire-contract', 'src/adapters/network/wireParse.ts', 'high'],
    ['guardrail-weakened', '.oxlintrc.json', 'high'],
    ['release-and-deploy', '.github/workflows/ci.yml', 'high'],
    ['dependencies', 'pnpm-lock.yaml', 'medium'],
  ])('puts a change to a %s file at its minimum risk', (name, path, risk) => {
    const floor = floorOf({ path })
    expect(namesOf(floor)).toContain(name)
    expect(floor.floor).toBe(risk)
  })

  it('matches a test file to the category of the file it tests', () => {
    expect(
      namesOf(floorOf({ path: 'src/adapters/network/signaling.test.ts' })),
    ).toContain('live-session-state')
  })

  it('matches a file in two categories when both list it', () => {
    expect(namesOf(floorOf({ path: 'src/domain/snapshot.ts' }))).toEqual(
      expect.arrayContaining(['domain-math', 'wire-contract']),
    )
  })

  it('treats a change to the catalogue itself as guardrail-weakened', () => {
    expect(namesOf(floorOf({ path: 'docs/review-risk.md' }))).toEqual([
      'guardrail-weakened',
    ])
  })

  it('matches the old path of a rename too', () => {
    const floor = floorOf({
      path: 'src/shared/estimate.ts',
      oldPath: 'src/domain/estimate/estimate.ts',
      status: 'renamed',
      similarity: 100,
    })
    expect(namesOf(floor)).toContain('domain-math')
    expect(floor.floor).toBe('high')
  })
})

describe('mechanical fallback', () => {
  it('applies to a docs-only change at the lowest risk', () => {
    const floor = floorOf({ path: 'docs/runbook-notes.md' }, { path: 'README.md' })
    expect(namesOf(floor)).toEqual(['mechanical'])
    expect(floor.floor).toBe('low')
  })

  it('applies to a pure rename of an unclassified file', () => {
    const floor = floorOf({
      path: 'src/shared/new.ts',
      oldPath: 'src/shared/old.ts',
      status: 'renamed',
      similarity: 100,
    })
    expect(namesOf(floor)).toEqual(['mechanical'])
  })

  it('does not apply when another category matched', () => {
    expect(namesOf(floorOf({ path: 'README.md' }, { path: 'src/domain/a.ts' }))).toEqual([
      'domain-math',
    ])
  })

  it('does not apply when one file is neither docs nor a pure rename', () => {
    const floor = floorOf({ path: 'README.md' }, { path: 'src/shared/ui/button.ts' })
    expect(floor.categories).toEqual([])
    expect(floor.floor).toBe('low')
  })

  it('does not treat a renamed file with edits as a pure rename', () => {
    const floor = floorOf({
      path: 'src/shared/new.ts',
      oldPath: 'src/shared/old.ts',
      status: 'renamed',
      similarity: 80,
    })
    expect(floor.categories).toEqual([])
  })

  it('has the floor low and no category for an empty change', () => {
    expect(floorOf()).toEqual({ floor: 'low', categories: [] })
  })
})

describe('diff checks', () => {
  const viteConfig = (n: number) =>
    `thresholds: { 'src/domain/**': { lines: ${n}, branches: ${n} } }`

  it('flags a lowered coverage threshold', () => {
    const floor = floorOf({
      path: 'vite.config.ts',
      before: viteConfig(100),
      after: viteConfig(90),
    })
    expect(floor.categories[0]?.diffChecks).toEqual(['coverageThresholdLowered'])
  })

  it('flags a removed coverage threshold', () => {
    const floor = floorOf({
      path: 'vite.config.ts',
      before: viteConfig(100),
      after: 'export default {}',
    })
    expect(floor.categories[0]?.diffChecks).toEqual(['coverageThresholdLowered'])
  })

  it('does not flag a raised or unchanged threshold', () => {
    const raised = floorOf({
      path: 'vite.config.ts',
      before: viteConfig(90),
      after: viteConfig(100),
    })
    expect(raised.categories[0]?.diffChecks).toEqual([])
  })

  it('flags a deleted test file even outside the guardrail paths', () => {
    const floor = floorOf({ path: 'src/shared/lib/format.test.ts', status: 'deleted' })
    expect(namesOf(floor)).toEqual(['guardrail-weakened'])
    expect(floor.floor).toBe('high')
  })

  it.each([
    'it.skip("x", () => {})',
    'describe.only("x", () => {})',
    'xit("x", () => {})',
    'xdescribe("x", () => {})',
  ])('flags %s added to a test', (line) => {
    const floor = floorOf({ path: 'src/shared/lib/format.test.ts', added: [line] })
    expect(floor.categories[0]?.diffChecks).toEqual(['testsRemovedOrSkipped'])
  })

  it('flags skipIf and todo as well', () => {
    const floor = floorOf({
      path: 'src/shared/lib/format.test.ts',
      added: ['  it.skipIf(slow)("x", () => {})'],
    })
    expect(floor.categories[0]?.diffChecks).toEqual(['testsRemovedOrSkipped'])
  })

  it('does not flag a string that only mentions a skipped test', () => {
    const floor = floorOf({
      path: 'src/shared/lib/format.test.ts',
      added: ['  \'it.skip("x")\','],
    })
    expect(floor.categories).toEqual([])
  })

  it('does not flag a skip in a file that is not a test', () => {
    const floor = floorOf({ path: 'src/shared/lib/format.ts', added: ['list.skip(1)'] })
    expect(floor.categories).toEqual([])
  })

  it('flags a strict flag turned off or removed in a tsconfig', () => {
    const on = '"strict": true,\n"noUncheckedIndexedAccess": true'
    const off = floorOf({
      path: 'tsconfig.app.json',
      before: on,
      after: '"strict": false,\n"noUncheckedIndexedAccess": true',
    })
    const removed = floorOf({
      path: 'tsconfig.app.json',
      before: on,
      after: '"strict": true',
    })
    expect(off.categories[0]?.diffChecks).toEqual(['strictnessLoosened'])
    expect(removed.categories[0]?.diffChecks).toEqual(['strictnessLoosened'])
  })

  it('does not flag a strict flag that stays on or an unrelated option', () => {
    const floor = floorOf({
      path: 'tsconfig.app.json',
      before: '"strict": true,\n"noEmit": true',
      after: '"strict": true,\n"noEmit": false',
    })
    expect(floor.categories[0]?.diffChecks).toEqual([])
  })

  it('flags a changed dependency field and ignores the version', () => {
    const pkg = (version: string, dep: string) =>
      JSON.stringify({ version, dependencies: { react: dep } })
    const bumped = floorOf({
      path: 'package.json',
      before: pkg('1.0.0', '^19.0.0'),
      after: pkg('1.0.1', '^19.0.0'),
    })
    const changed = floorOf({
      path: 'package.json',
      before: pkg('1.0.0', '^19.0.0'),
      after: pkg('1.0.0', '^20.0.0'),
    })
    expect(bumped.categories).toEqual([])
    expect(changed.categories[0]?.diffChecks).toEqual(['dependencyFieldsChanged'])
    expect(changed.floor).toBe('medium')
  })

  it('flags a new package.json dependency field from nothing', () => {
    const floor = floorOf({
      path: 'package.json',
      before: '{}',
      after: JSON.stringify({ devDependencies: { yaml: '^2.0.0' } }),
    })
    expect(namesOf(floor)).toEqual(['dependencies'])
  })
})

describe('parseCatalogue', () => {
  const block = (yaml: string) => 'text\n\n```yaml\n' + yaml + '\n```\n'
  const valid = "- name: a-b\n  min-risk: low\n  paths: ['x/**']"

  it('reads a valid block', () => {
    expect(parseCatalogue(block(valid))).toEqual([
      { name: 'a-b', minRisk: 'low', paths: ['x/**'], diffChecks: [], fallback: false },
    ])
  })

  it.each([
    ['no yaml block', 'just text', /expected one yaml block, found 0/],
    ['two yaml blocks', block(valid) + block(valid), /found 2/],
    ['an unknown key', block(valid + '\n  triggers: []'), /unknown key "triggers"/],
    ['a missing min-risk', block('- name: a\n  paths: []'), /min-risk/],
    [
      'an unknown risk level',
      block('- name: a\n  min-risk: severe\n  paths: []'),
      /min-risk/,
    ],
    [
      'an unknown diff check',
      block(valid + '\n  diff-checks: [nope]'),
      /unknown diff check "nope"/,
    ],
    [
      'a name that is not kebab-case',
      block('- name: Foo_Bar\n  min-risk: low\n  paths: []'),
      /kebab-case/,
    ],
    ['a duplicate name', block(valid + '\n' + valid), /duplicate name/],
    [
      'paths that are not a list',
      block("- name: a\n  min-risk: low\n  paths: 'x'"),
      /paths must be a list/,
    ],
    [
      'two fallbacks',
      block(
        valid +
          '\n  fallback: true\n' +
          valid.replace('a-b', 'c-d') +
          '\n  fallback: true',
      ),
      /at most one/,
    ],
    ['a block that is not a list', block('name: a'), /not a list/],
  ])('rejects %s', (_label, markdown, message) => {
    expect(() => parseCatalogue(markdown)).toThrow(message)
  })

  it('parses the real catalogue with every documented category', () => {
    expect(catalogue.map((c) => c.name)).toEqual([
      'domain-math',
      'live-session-state',
      'wire-contract',
      'guardrail-weakened',
      'release-and-deploy',
      'dependencies',
      'mechanical',
    ])
    expect(catalogue.filter((c) => c.fallback).map((c) => c.name)).toEqual(['mechanical'])
  })
})

describe('readGitDiff', () => {
  const sandbox = mkdtempSync(join(tmpdir(), 'review-floor-'))
  afterAll(() => rmSync(sandbox, { recursive: true, force: true }))

  const git = (...args: string[]) =>
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], {
      cwd: sandbox,
      encoding: 'utf8',
    })
  const write = (path: string, text: string) => {
    mkdirSync(dirname(join(sandbox, path)), { recursive: true })
    writeFileSync(join(sandbox, path), text)
  }

  it('lists added, modified, deleted, renamed and untracked files with their text', () => {
    git('init', '-q', '-b', 'main')
    write('keep.ts', 'one\ntwo\nthree\nfour\nfive\n')
    write('gone.ts', 'bye\n')
    write('old-name.ts', 'a long enough file\nwith several lines\nthat stay the same\n')
    git('add', '.')
    git('commit', '-q', '-m', 'base')
    const base = git('rev-parse', 'HEAD').trim()

    git('checkout', '-q', '-b', 'feature')
    write('keep.ts', 'one\ntwo\nthree\nfour\nfive\nsix\n')
    git('rm', '-q', 'gone.ts')
    git('mv', 'old-name.ts', 'new-name.ts')
    write('added.ts', 'fresh\n')
    git('add', '.')
    git('commit', '-q', '-m', 'change')
    write('untracked.ts', 'u1\nu2\n')

    const diff = readGitDiff({ cwd: sandbox, from: base })
    const byPath = Object.fromEntries(diff.files.map((f) => [f.path, f]))

    expect(byPath['keep.ts']?.status).toBe('modified')
    expect(byPath['gone.ts']?.status).toBe('deleted')
    expect(byPath['added.ts']?.status).toBe('added')
    expect(byPath['untracked.ts']?.status).toBe('added')
    expect(byPath['new-name.ts']).toMatchObject({
      status: 'renamed',
      oldPath: 'old-name.ts',
      similarity: 100,
    })

    expect(diff.before('keep.ts')).toBe('one\ntwo\nthree\nfour\nfive\n')
    expect(diff.after('keep.ts')).toContain('six')
    expect(diff.before('added.ts')).toBeUndefined()
    expect(diff.after('gone.ts')).toBeUndefined()
    expect(diff.addedLines(byPath['keep.ts'] as ChangedFile)).toEqual(['six'])
    write('keep.ts', 'one\ntwo\nthree\nfour\nfive\nsix\n++i\n')
    expect(diff.addedLines(byPath['keep.ts'] as ChangedFile)).toEqual(['six', '++i'])
    expect(diff.addedLines(byPath['untracked.ts'] as ChangedFile)).toEqual([
      'u1',
      'u2',
      '',
    ])
  })

  it('reports only what changed since a given commit', () => {
    git('checkout', '--', 'keep.ts')
    const since = git('rev-parse', 'HEAD').trim()
    write('later.ts', 'later\n')
    git('add', '.')
    git('commit', '-q', '-m', 'later')
    const diff = readGitDiff({ cwd: sandbox, from: since })
    expect(diff.files.map((f) => f.path).sort()).toEqual(['later.ts', 'untracked.ts'])
  })
})
