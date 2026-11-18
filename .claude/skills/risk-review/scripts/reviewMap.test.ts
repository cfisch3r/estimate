// @vitest-environment node
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { ChangedFile } from './changedDiff.ts'
import {
  buildChangesetMap,
  parseMapConfig,
  placeFile,
  readChangesetMap,
  type ChangesetMap,
  type Folder,
  type MapConfig,
} from './reviewMap.ts'

// The changeset map places every changed file of a branch: in a layer and slice of the
// app, in one of the side strips for files outside the source root, or off the map. All
// of this repo's specifics come from the plugin's configuration file.

const REPO_CONFIG = new URL('../changeset-map.yaml', import.meta.url)
const repoConfig = () => parseMapConfig(readFileSync(REPO_CONFIG, 'utf8'))

const config: MapConfig = {
  sourceRoot: 'src',
  layers: [{ name: 'app', wholeSlice: true }, { name: 'features' }, { name: 'domain' }],
  strips: [
    { name: 'Docs', paths: ['docs/**', '**/*.md'] },
    { name: 'Tooling', paths: ['scripts/**', '*.json', '**/*.md'] },
  ],
  offMap: ['**/*.test.ts', '**/*.css'],
}

describe('parseMapConfig', () => {
  it("parses the repo's changeset-map.yaml", () => {
    const parsed = repoConfig()
    expect(parsed.layers.map((l) => l.name)).toEqual([
      'app',
      'pages',
      'widgets',
      'features',
      'entities',
      'shared',
      'application',
      'domain',
      'adapters',
    ])
    expect(parsed.layers.filter((l) => l.side)).toHaveLength(1)
  })

  it.each([
    [
      'layers is not a list',
      'sourceRoot: src\nlayers: 3\nstrips: []\noffMap: []',
      /layers/,
    ],
    [
      'a layer has no name',
      'sourceRoot: src\nlayers:\n  - name: app\n  - group: ui\nstrips: []\noffMap: []',
      /layers\[1\]\.name/,
    ],
    [
      'an unknown top-level key',
      'sourceRoot: src\nlayers: []\nstrips: []\noffMap: []\nextra: 1',
      /unknown key "extra"/,
    ],
    [
      "a strip's paths are not a string list",
      'sourceRoot: src\nlayers: []\nstrips:\n  - name: Docs\n    paths: docs\noffMap: []',
      /strips\[0\]\.paths/,
    ],
    [
      'an unknown group',
      'sourceRoot: src\nlayers:\n  - name: app\n    group: core\nstrips: []\noffMap: []',
      /layers\[0\]\.group/,
    ],
    [
      'two side layers',
      'sourceRoot: src\nlayers:\n  - name: a\n    side: true\n  - name: b\n    side: true\nstrips: []\noffMap: []',
      /side/,
    ],
    [
      'a flag is not true or false',
      'sourceRoot: src\nlayers:\n  - name: a\n    side: yes please\nstrips: []\noffMap: []',
      /layers\[0\]\.side/,
    ],
    [
      'two layers share a name',
      'sourceRoot: src\nlayers:\n  - name: app\n  - name: app\nstrips: []\noffMap: []',
      /layers\[1\]\.name.*"app"/,
    ],
    [
      'a layer takes the reserved name Unplaced',
      'sourceRoot: src\nlayers:\n  - name: Unplaced\nstrips: []\noffMap: []',
      /layers\[0\]\.name.*"Unplaced"/,
    ],
    [
      'two strips share a name',
      'sourceRoot: src\nlayers: []\nstrips:\n  - name: Docs\n    paths: []\n  - name: Docs\n    paths: []\noffMap: []',
      /strips\[1\]\.name.*"Docs"/,
    ],
    [
      'a strip takes the reserved name Other',
      'sourceRoot: src\nlayers: []\nstrips:\n  - name: Other\n    paths: []\noffMap: []',
      /strips\[0\]\.name.*"Other"/,
    ],
    [
      'offMap is not a list',
      'sourceRoot: src\nlayers: []\nstrips: []\noffMap: 1',
      /offMap/,
    ],
  ])('names the field when %s', (_, text, message) => {
    expect(() => parseMapConfig(text)).toThrow(message)
  })
})

describe('placeFile', () => {
  it('places a file in its layer and slice', () => {
    expect(placeFile('src/features/session-persistence/ui/Row.tsx', config)).toEqual({
      kind: 'layer',
      layer: 'features',
      slice: 'session-persistence',
    })
  })

  it('treats a wholeSlice layer as one slice', () => {
    expect(placeFile('src/app/routes/x.ts', config)).toEqual({
      kind: 'layer',
      layer: 'app',
      slice: 'app',
    })
  })

  it('uses (root) for a file directly in a layer folder', () => {
    expect(placeFile('src/domain/round.ts', config)).toEqual({
      kind: 'layer',
      layer: 'domain',
      slice: '(root)',
    })
  })

  it('keeps off-map files off the map', () => {
    expect(placeFile('src/domain/round.test.ts', config)).toEqual({ kind: 'off' })
    expect(placeFile('src/features/x/ui/x.css', config)).toEqual({ kind: 'off' })
  })

  it('puts a src file outside every layer in unplaced', () => {
    expect(placeFile('src/main.tsx', config)).toEqual({ kind: 'unplaced' })
    expect(placeFile('src/design/tokens.ts', config)).toEqual({ kind: 'unplaced' })
  })

  it('places a file by the first matching strip', () => {
    expect(placeFile('scripts/README.md', config)).toEqual({
      kind: 'strip',
      strip: 'Docs',
    })
    expect(placeFile('scripts/run.ts', config)).toEqual({
      kind: 'strip',
      strip: 'Tooling',
    })
  })

  it('puts a file outside src that matches no strip in Other', () => {
    expect(placeFile('LICENSE', config)).toEqual({ kind: 'strip', strip: 'Other' })
  })

  it('keeps test files under dot folders off the map with the repo configuration', () => {
    expect(
      placeFile('.claude/skills/risk-review/scripts/reviewMap.test.ts', repoConfig()),
    ).toEqual({ kind: 'off' })
  })

  it('puts AGENTS.md and agent prompts into Docs with the repo configuration', () => {
    const repo = repoConfig()
    expect(placeFile('AGENTS.md', repo)).toEqual({ kind: 'strip', strip: 'Docs' })
    expect(placeFile('.claude/skills/risk-review/SKILL.md', repo)).toEqual({
      kind: 'strip',
      strip: 'Docs',
    })
    expect(placeFile('.claude/settings.json', repo)).toEqual({
      kind: 'strip',
      strip: 'Agent, CI and tooling',
    })
    expect(placeFile('e2e/relay-server.mjs', repo)).toEqual({
      kind: 'strip',
      strip: 'Specs',
    })
    expect(placeFile('package.json', repo)).toEqual({
      kind: 'strip',
      strip: 'Agent, CI and tooling',
    })
  })
})

const added = (path: string): ChangedFile => ({ path, status: 'added' })
const layerRoot = (map: ChangesetMap, name: string): Folder => {
  const layer = map.layers.find((l) => l.name === name)
  if (!layer) throw new Error(`no layer ${name}`)
  return layer.root
}
const folder = (parent: Folder, label: string): Folder => {
  const found = parent.folders.find((f) => f.label === label)
  if (!found) throw new Error(`no folder ${label} in ${parent.path}`)
  return found
}

describe('buildChangesetMap', () => {
  it('maps git statuses', () => {
    const map = buildChangesetMap(
      [
        added('src/domain/a.ts'),
        { path: 'src/domain/b.ts', status: 'modified' },
        { path: 'src/domain/c.ts', status: 'deleted' },
      ],
      config,
    )
    const files = folder(layerRoot(map, 'domain'), '(root)').files
    expect(files.map((f) => [f.path, f.status])).toEqual([
      ['src/domain/a.ts', 'added'],
      ['src/domain/b.ts', 'changed'],
      ['src/domain/c.ts', 'deleted'],
    ])
  })

  it('puts a ghost at the old place of a file moved across layers', () => {
    const map = buildChangesetMap(
      [
        {
          path: 'src/features/y/A.tsx',
          oldPath: 'src/domain/x/A.tsx',
          status: 'renamed',
        },
      ],
      config,
    )
    expect(folder(layerRoot(map, 'features'), 'y').files).toEqual([
      { path: 'src/features/y/A.tsx', status: 'moved', from: 'src/domain/x/A.tsx' },
    ])
    expect(folder(layerRoot(map, 'domain'), 'x').files).toEqual([
      { path: 'src/domain/x/A.tsx', status: 'ghost', movedTo: 'src/features/y/A.tsx' },
    ])
  })

  it('counts a renamed off-map file once', () => {
    const map = buildChangesetMap(
      [
        {
          path: 'src/domain/b.test.ts',
          oldPath: 'src/domain/a.test.ts',
          status: 'renamed',
        },
      ],
      config,
    )
    expect(map.offMap).toBe(1)
  })

  it('leaves no ghost when a file moves off the map', () => {
    const map = buildChangesetMap(
      [
        {
          path: 'src/domain/x/a.test.ts',
          oldPath: 'src/domain/x/a.ts',
          status: 'renamed',
        },
      ],
      config,
    )
    expect(map.offMap).toBe(1)
    expect(layerRoot(map, 'domain').folders).toEqual([])
  })

  it('shows a file moved onto the map without a ghost at its off-map place', () => {
    const map = buildChangesetMap(
      [
        {
          path: 'src/domain/x/a.ts',
          oldPath: 'src/domain/x/a.test.ts',
          status: 'renamed',
        },
      ],
      config,
    )
    expect(map.offMap).toBe(0)
    expect(folder(layerRoot(map, 'domain'), 'x').files).toEqual([
      { path: 'src/domain/x/a.ts', status: 'moved', from: 'src/domain/x/a.test.ts' },
    ])
  })

  it('counts off-map files', () => {
    const map = buildChangesetMap(
      [
        added('src/domain/a.test.ts'),
        added('src/domain/b.test.ts'),
        added('src/features/x/x.css'),
      ],
      config,
    )
    expect(map.offMap).toBe(3)
    expect(layerRoot(map, 'domain').folders).toEqual([])
    expect(layerRoot(map, 'features').folders).toEqual([])
  })

  it('collapses a slice with more than four changed files', () => {
    const busy = ['a', 'b', 'c', 'd'].map((n) => added(`src/features/busy/model/${n}.ts`))
    const quiet = ['a', 'b', 'c', 'd'].map((n) => added(`src/features/quiet/${n}.ts`))
    const map = buildChangesetMap(
      [...busy, added('src/features/busy/ui/e.tsx'), ...quiet],
      config,
    )
    const features = layerRoot(map, 'features')
    expect(folder(features, 'busy')).toMatchObject({ changed: 5, startsCollapsed: true })
    expect(folder(features, 'quiet')).toMatchObject({
      changed: 4,
      startsCollapsed: false,
    })
    expect(folder(folder(features, 'busy'), 'model').startsCollapsed).toBe(false)
  })

  it('does not count a ghost as a changed file', () => {
    const moves = ['a', 'b', 'c', 'd', 'e'].map((n): ChangedFile => ({
      path: `src/features/new/${n}.ts`,
      oldPath: `src/features/old/${n}.ts`,
      status: 'renamed',
    }))
    const features = layerRoot(buildChangesetMap(moves, config), 'features')
    expect(folder(features, 'old')).toMatchObject({ changed: 0, startsCollapsed: false })
    expect(folder(features, 'new')).toMatchObject({ changed: 5, startsCollapsed: true })
  })

  it('folds a single-child chain', () => {
    const map = buildChangesetMap(
      [
        added('src/features/session-history/ui/A.tsx'),
        added('src/features/session-history/ui/B.tsx'),
      ],
      config,
    )
    const chain = folder(layerRoot(map, 'features'), 'session-history/ui')
    expect(chain.path).toBe('src/features/session-history/ui')
    expect(chain.files.map((f) => f.path)).toEqual([
      'src/features/session-history/ui/A.tsx',
      'src/features/session-history/ui/B.tsx',
    ])
  })

  it('sorts files before folders, each by name', () => {
    const map = buildChangesetMap(
      [
        added('src/features/x/z.ts'),
        added('src/features/x/b/c.ts'),
        added('src/features/x/a.ts'),
      ],
      config,
    )
    const x = folder(layerRoot(map, 'features'), 'x')
    expect(x.files.map((f) => f.path)).toEqual([
      'src/features/x/a.ts',
      'src/features/x/z.ts',
    ])
    expect(x.folders.map((f) => f.label)).toEqual(['b'])
  })

  it('marks a folder holding one file as not collapsible', () => {
    const map = buildChangesetMap(
      [
        added('src/features/one/a.ts'),
        added('src/features/two/a.ts'),
        added('src/features/two/b.ts'),
      ],
      config,
    )
    expect(folder(layerRoot(map, 'features'), 'one').collapsible).toBe(false)
    expect(folder(layerRoot(map, 'features'), 'two').collapsible).toBe(true)
  })

  it('lists only strips with files, Other last', () => {
    const map = buildChangesetMap(
      [added('LICENSE'), added('package.json'), added('docs/a.md')],
      config,
    )
    expect(map.strips.map((s) => [s.name, s.files.map((f) => f.path)])).toEqual([
      ['Docs', ['docs/a.md']],
      ['Tooling', ['package.json']],
      ['Other', ['LICENSE']],
    ])
  })

  it('keeps every configured layer in order and adds Unplaced only when it holds files', () => {
    expect(buildChangesetMap([], config).layers.map((l) => l.name)).toEqual([
      'app',
      'features',
      'domain',
    ])
    expect(
      buildChangesetMap([added('src/main.tsx')], config).layers.map((l) => l.name),
    ).toEqual(['app', 'features', 'domain', 'Unplaced'])
  })
})

describe('readChangesetMap', () => {
  it('reports a missing configuration as not available', () => {
    expect(readChangesetMap(() => [], '/nonexistent/changeset-map.yaml')).toEqual({
      status: 'not available',
      reason: 'changeset-map.yaml not found',
    })
  })

  it('reports an invalid configuration as not available with the field', () => {
    const dir = mkdtempSync(join(tmpdir(), 'changeset-map-'))
    try {
      const path = join(dir, 'changeset-map.yaml')
      writeFileSync(path, 'sourceRoot: src\nlayers: 3\nstrips: []\noffMap: []\n')
      const result = readChangesetMap(() => [], path)
      expect(result.status).toBe('not available')
      expect(result.status === 'not available' && result.reason).toMatch(/layers/)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it("builds the map with the repo's configuration", () => {
    const result = readChangesetMap(
      () => [added('src/domain/a.ts')],
      new URL('../changeset-map.yaml', import.meta.url).pathname,
    )
    expect(result.status).toBe('ok')
  })

  it('reports a failing read of the changed files as not available', () => {
    const result = readChangesetMap(
      () => {
        throw new Error('fatal: bad revision')
      },
      new URL('../changeset-map.yaml', import.meta.url).pathname,
    )
    expect(result).toEqual({
      status: 'not available',
      reason: 'reading the changed files failed: fatal: bad revision',
    })
  })
})
