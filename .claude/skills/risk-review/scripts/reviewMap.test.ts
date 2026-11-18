// @vitest-environment node
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { ChangedFile } from './changedDiff.ts'
import type { ExportInfo } from './reviewExports.ts'
import type { ImportChange } from './reviewImports.ts'
import {
  buildChangesetMap,
  parseMapConfig,
  placeFile,
  readChangesetMap,
  type ChangesetMap,
  type Folder,
  type MapConfig,
  type MapFile,
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

describe('buildChangesetMap with imports', () => {
  const imp = (
    from: string,
    to: string,
    status: ImportChange['status'],
  ): ImportChange => ({ from, to, status, names: ['x'] })
  const ok = (...edges: ImportChange[]) => ({ status: 'ok' as const, edges })
  const filesOf = (map: ChangesetMap) =>
    map.layers.flatMap((l) => {
      const walk = (f: Folder): ChangesetMap['layers'][number]['root']['files'] => [
        ...f.files,
        ...f.folders.flatMap(walk),
      ]
      return walk(l.root)
    })

  it('adds an unchanged file that an added or removed import points at', () => {
    const map = buildChangesetMap(
      [{ path: 'src/features/a.ts', status: 'modified' }],
      config,
      ok(
        imp('src/features/a.ts', 'src/domain/new.ts', 'added'),
        imp('src/features/a.ts', 'src/domain/old.ts', 'removed'),
        imp('src/features/a.ts', 'src/domain/kept.ts', 'kept'),
      ),
    )
    expect(filesOf(map)).toEqual([
      { path: 'src/features/a.ts', status: 'changed' },
      { path: 'src/domain/new.ts', status: 'context' },
      { path: 'src/domain/old.ts', status: 'context' },
    ])
  })

  it('does not count an unchanged file as changed', () => {
    const map = buildChangesetMap(
      [{ path: 'src/features/a.ts', status: 'modified' }],
      config,
      ok(imp('src/features/a.ts', 'src/domain/new.ts', 'added')),
    )
    expect(map.layers.find((l) => l.name === 'domain')?.root.changed).toBe(0)
  })

  it('keeps the edges from files on the map and drops those from files off it', () => {
    const edges = [
      imp('src/features/a.ts', 'src/domain/b.ts', 'added'),
      imp('src/features/a.ts', 'src/domain/c.ts', 'kept'),
      imp('src/features/a.test.ts', 'src/features/a.ts', 'added'),
    ]
    const map = buildChangesetMap(
      [added('src/features/a.ts'), added('src/features/a.test.ts')],
      config,
      ok(...edges),
    )
    expect(map.imports).toEqual({
      ...ok(edges[0] as ImportChange, edges[1] as ImportChange),
      uses: [],
    })
  })

  it('adds no box for an off-map file an import points at', () => {
    const map = buildChangesetMap(
      [added('src/features/a.ts')],
      config,
      ok(imp('src/features/a.ts', 'src/features/a.test.ts', 'added')),
    )
    expect(filesOf(map).map((f) => f.path)).toEqual(['src/features/a.ts'])
    expect(map.offMap).toBe(0)
  })

  it('passes on why the imports are not available', () => {
    const reason = {
      status: 'not available' as const,
      reason: 'tsconfig.app.json not found',
    }
    expect(
      buildChangesetMap([added('src/features/a.ts')], config, reason).imports,
    ).toEqual(reason)
  })
})

describe('buildChangesetMap with exports', () => {
  const B = 'src/domain/e/b.ts'
  const A = 'src/features/x/A.ts'
  const kept = (from: string, to: string, ...names: string[]): ImportChange => ({
    from,
    to,
    names,
    status: 'kept',
  })
  const code = (
    edges: ImportChange[],
    exports: Record<string, ExportInfo[]> = {},
    rest: {
      barrels?: Record<string, { added: string[]; removed: string[] }>
      docs?: Record<string, string>
    } = {},
  ) => ({ status: 'ok' as const, edges, exports, ...rest })
  const changedB = { [B]: [{ name: 'b', change: 'changed' as const }] }
  const filesOf = (map: ChangesetMap) =>
    map.layers.flatMap((l) => {
      const walk = (f: Folder): MapFile[] => [...f.files, ...f.folders.flatMap(walk)]
      return walk(l.root)
    })
  const fileOf = (map: ChangesetMap, path: string) =>
    filesOf(map).find((f) => f.path === path)
  const usesOf = (map: ChangesetMap) =>
    map.imports.status === 'ok' ? map.imports.uses : []

  it('adds an unchanged file that uses a changed export as an importer', () => {
    const map = buildChangesetMap(
      [{ path: B, status: 'modified' }],
      config,
      code([kept(A, B, 'b')], changedB),
    )
    expect(fileOf(map, A)).toEqual({ path: A, status: 'importer' })
    expect(usesOf(map)).toEqual([{ from: A, to: B, names: ['b'] }])
    expect(fileOf(map, B)).toEqual({
      path: B,
      status: 'changed',
      exports: [{ name: 'b', change: 'changed' }],
      reach: 1,
    })
  })

  it('leaves out an importer that uses only unchanged exports', () => {
    const map = buildChangesetMap(
      [{ path: B, status: 'modified' }],
      config,
      code([kept(A, B, 'b')], { [B]: [{ name: 'b' }, { name: 'c', change: 'changed' }] }),
    )
    expect(fileOf(map, A)).toBeUndefined()
    expect(fileOf(map, B)?.reach).toBeUndefined()
  })

  it('does not count a re-export as a use', () => {
    const map = buildChangesetMap(
      [{ path: B, status: 'modified' }],
      config,
      code([{ ...kept(A, B, 'b'), reexports: ['b'] }], changedB),
    )
    expect(fileOf(map, A)).toBeUndefined()
  })

  it('gives a removed export no importers', () => {
    const map = buildChangesetMap(
      [{ path: B, status: 'modified' }],
      config,
      code([kept(A, B, 'b')], { [B]: [{ name: 'b', change: 'removed' }] }),
    )
    expect(fileOf(map, A)).toBeUndefined()
  })

  it('counts a namespace used whole', () => {
    const map = buildChangesetMap(
      [{ path: B, status: 'modified' }],
      config,
      code([kept(A, B, '*')], changedB),
    )
    expect(usesOf(map)).toEqual([{ from: A, to: B, names: ['*'] }])
  })

  it('marks a context file that is also an importer', () => {
    const C = 'src/features/c.ts'
    const map = buildChangesetMap(
      [
        { path: B, status: 'modified' },
        { path: C, status: 'modified' },
      ],
      config,
      code([{ ...kept(C, A, 'a'), status: 'added' }, kept(A, B, 'b')], changedB),
    )
    expect(fileOf(map, A)).toEqual({ path: A, status: 'context', importer: true })
  })

  it('counts an importer off the map in the reach but places no box', () => {
    const map = buildChangesetMap(
      [{ path: B, status: 'modified' }],
      config,
      code([kept('scripts/s.ts', B, 'b')], changedB),
    )
    expect(fileOf(map, 'scripts/s.ts')).toBeUndefined()
    expect(map.strips).toEqual([])
    expect(fileOf(map, B)?.reach).toBe(1)
    expect(usesOf(map)).toEqual([{ from: 'scripts/s.ts', to: B, names: ['b'] }])
  })

  it('does not count a test or another off-map file as an importer', () => {
    const map = buildChangesetMap(
      [{ path: B, status: 'modified' }],
      config,
      code([kept('src/features/x/A.test.ts', B, 'b')], changedB),
    )
    expect(usesOf(map)).toEqual([])
    expect(fileOf(map, B)?.reach).toBeUndefined()
  })

  it('does not count importers as changed files', () => {
    const map = buildChangesetMap(
      [{ path: B, status: 'modified' }],
      config,
      code([kept(A, B, 'b')], changedB),
    )
    expect(map.layers.find((l) => l.name === 'features')?.root.changed).toBe(0)
  })

  it('puts the barrel diff on the folder that holds the barrel', () => {
    const map = buildChangesetMap(
      [
        { path: B, status: 'modified' },
        { path: 'src/domain/e/index.ts', status: 'modified' },
      ],
      config,
      code(
        [],
        {},
        {
          barrels: {
            'src/domain/e/index.ts': { added: ['x', 'y'], removed: [] },
            'src/domain/e/more.ts': { added: [], removed: ['z'] },
          },
        },
      ),
    )
    const folder = map.layers.find((l) => l.name === 'domain')?.root.folders[0]
    expect(folder?.path).toBe('src/domain/e')
    expect(folder?.api).toEqual({ added: 2, removed: 1 })
  })

  it("gives an importer its doc comment and no other file's", () => {
    const map = buildChangesetMap(
      [{ path: B, status: 'modified' }],
      config,
      code([kept(A, B, 'b')], changedB, {
        docs: { [A]: 'The A file.', [B]: 'The b file.' },
      }),
    )
    expect(fileOf(map, A)?.doc).toBe('The A file.')
    expect(fileOf(map, B)?.doc).toBeUndefined()
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

  it('keeps the map when reading the imports fails', () => {
    const result = readChangesetMap(
      () => [added('src/domain/a.ts')],
      new URL('../changeset-map.yaml', import.meta.url).pathname,
      () => {
        throw new Error('bad object abc')
      },
    )
    expect(result.status === 'ok' && result.imports).toEqual({
      status: 'not available',
      reason: 'reading the imports failed: bad object abc',
    })
  })

  it('hands the changed files to the import reader', () => {
    const seen: ChangedFile[][] = []
    readChangesetMap(
      () => [added('src/domain/a.ts')],
      new URL('../changeset-map.yaml', import.meta.url).pathname,
      (files) => {
        seen.push(files)
        return { edges: [] }
      },
    )
    expect(seen).toEqual([[added('src/domain/a.ts')]])
  })
})
