// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseMapConfig, placeFile, type MapConfig } from './reviewMap.ts'

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
