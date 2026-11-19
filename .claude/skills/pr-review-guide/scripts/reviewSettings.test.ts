// @vitest-environment node
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { repoRoot } from './changedDiff.ts'
import { mapConfigOf } from './reviewMap.ts'
import {
  DEFAULT_CATALOGUE,
  SETTINGS_PATH,
  parseSettings,
  readSettings,
} from './reviewSettings.ts'

// The project's settings for the plugin: where the catalogue is and how the changeset map
// is laid out. The floor reads them from the base branch, so a pull request cannot point
// its own floor at a weaker catalogue.

describe('parseSettings', () => {
  it('reads the catalogue path and keeps the map part as it is', () => {
    const settings = parseSettings('catalogue: risk.md\nmap:\n  sourceRoot: src\n')
    expect(settings).toEqual({
      catalogue: 'risk.md',
      map: { sourceRoot: 'src' },
      fromFile: true,
    })
  })

  it('uses the default catalogue and no map when the file names neither', () => {
    expect(parseSettings('{}')).toEqual({
      catalogue: DEFAULT_CATALOGUE,
      map: undefined,
      fromFile: true,
    })
  })

  it.each([
    ['a file that is not a mapping', '- a\n- b\n', /not a mapping/],
    ['an unknown key', 'catalogue: risk.md\ncatalog: x\n', /unknown key "catalog"/],
    ['a catalogue that is not a path', 'catalogue: [a]\n', /catalogue must be a path/],
    ['an empty catalogue', "catalogue: ''\n", /catalogue must be a path/],
    ['a catalogue key without a value', 'catalogue:\n', /catalogue must be a path/],
  ])('rejects %s', (_label, source, message) => {
    expect(() => parseSettings(source)).toThrow(message)
  })

  it("parses the repo's own settings, map included", () => {
    const root = repoRoot(import.meta.dirname)
    const settings = parseSettings(readFileSync(join(root, SETTINGS_PATH), 'utf8'))
    expect(settings.catalogue).toBe('docs/technical/pr-review-catalogue.md')
    expect(mapConfigOf(settings.map).sourceRoot).toBe('src')
  })
})

describe('readSettings', () => {
  const dir = mkdtempSync(join(tmpdir(), 'review-settings-'))
  afterAll(() => rmSync(dir, { recursive: true, force: true }))
  const git = (...args: string[]) =>
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], {
      cwd: dir,
      encoding: 'utf8',
    })
  const commit = (message: string) => {
    git('add', '-A')
    git('commit', '-q', '--allow-empty', '-m', message)
    return git('rev-parse', 'HEAD').trim()
  }

  it('uses the defaults when the base branch has no settings file', () => {
    git('init', '-q', '-b', 'main')
    const base = commit('empty')
    expect(readSettings(base, dir)).toEqual({
      catalogue: DEFAULT_CATALOGUE,
      map: undefined,
      fromFile: false,
    })
  })

  it('reads the file at the base branch, not the one in the working tree', () => {
    writeFileSync(join(dir, SETTINGS_PATH), 'catalogue: strict.md\n')
    const base = commit('settings')
    writeFileSync(join(dir, SETTINGS_PATH), 'catalogue: lenient.md\n')
    expect(readSettings(base, dir).catalogue).toBe('strict.md')
  })

  it('does not follow a rename to the settings file', () => {
    git('checkout', '-q', '--', '.')
    git('rm', '-q', SETTINGS_PATH)
    writeFileSync(
      join(dir, 'old-map.yaml'),
      'sourceRoot: src\nlayers:\n  - name: app\nstrips: []\noffMap: []\n',
    )
    const base = commit('old layout')
    git('mv', 'old-map.yaml', SETTINGS_PATH)
    expect(readSettings(base, dir)).toEqual({
      catalogue: DEFAULT_CATALOGUE,
      map: undefined,
      fromFile: false,
    })
  })

  it('fails when the file at the base branch is malformed', () => {
    git('checkout', '-q', '-f', 'HEAD')
    writeFileSync(join(dir, SETTINGS_PATH), 'catalogue: 3\n')
    const base = commit('broken')
    expect(() => readSettings(base, dir)).toThrow(/pr-review-guide\.yaml: catalogue/)
  })
})
