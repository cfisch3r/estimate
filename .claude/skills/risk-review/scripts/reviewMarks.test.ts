import { describe, expect, it } from 'vitest'
import type { HotSpot } from './reviewGuide.ts'
import { mapMarks, skimEntryFor } from './reviewMarks.ts'
import type { ChangesetMap, Folder, MapFile } from './reviewMap.ts'

// The guide's hot spots, skim-only entries and responsibilities become marks on the map,
// keyed by the paths the map draws.

const folder = (path: string, files: MapFile[], folders: Folder[] = []): Folder => ({
  path,
  label: path.slice(path.lastIndexOf('/') + 1),
  files,
  folders,
  changed: files.length,
  startsCollapsed: false,
  collapsible: true,
})

const map: ChangesetMap = {
  layers: [
    {
      name: 'domain',
      root: folder(
        'src/domain',
        [],
        [
          folder('src/domain/estimate', [
            { path: 'src/domain/estimate/estimate.ts', status: 'changed' },
            { path: 'src/domain/estimate/aggregate.ts', status: 'changed' },
          ]),
        ],
      ),
    },
    {
      name: 'pages',
      root: folder(
        'src/pages',
        [],
        [
          folder('src/pages/session-history', [
            { path: 'src/pages/session-history/index.ts', status: 'deleted' },
          ]),
          folder('src/pages/ui', [{ path: 'src/pages/ui/x.ts', status: 'context' }]),
        ],
      ),
    },
  ],
  strips: [
    {
      name: 'Docs',
      files: [
        { path: 'docs/a.md', status: 'changed' },
        { path: 'README.md', status: 'changed' },
      ],
    },
  ],
  offMap: 0,
  imports: { status: 'ok', edges: [], uses: [] },
}

const spot = (file: string): HotSpot => ({
  file,
  line: 1,
  title: 't',
  body: 'b',
  rule: 'general',
  facts: [],
})

const ESTIMATE = 'src/domain/estimate/estimate.ts'
const AGGREGATE = 'src/domain/estimate/aggregate.ts'

describe('mapMarks', () => {
  it('numbers the hot spots on the files the map draws', () => {
    const marks = mapMarks(
      map,
      [spot(ESTIMATE), spot('vite.config.ts'), spot(ESTIMATE)],
      [],
      [],
    )
    expect(marks.spots).toEqual({ [ESTIMATE]: [1, 3] })
  })

  it('numbers a hot spot on a strip row', () => {
    expect(mapMarks(map, [spot('docs/a.md')], [], []).spots).toEqual({ 'docs/a.md': [1] })
  })

  it('does not fade a hot spot file', () => {
    const marks = mapMarks(
      map,
      [spot(ESTIMATE)],
      [{ file: 'src/domain/', why: 'Follows the change.' }],
      [],
    )
    expect(marks.skim).toEqual({
      [AGGREGATE]: { entry: 'src/domain/', why: 'Follows the change.' },
    })
  })

  it('fades strip rows under a skim-only folder', () => {
    const marks = mapMarks(map, [], [{ file: 'docs/', why: 'Docs.' }], [])
    expect(Object.keys(marks.skim)).toEqual(['docs/a.md'])
  })

  it('keeps responsibilities only for changed boxes that are not skim-only', () => {
    const marks = mapMarks(
      map,
      [],
      [{ file: 'src/pages/session-history/', why: 'Removed on purpose.' }],
      [
        { file: ESTIMATE, text: 'Builds an estimate.' },
        { file: 'src/pages/ui/x.ts', text: 'Unchanged.' },
        { file: 'docs/a.md', text: 'A doc.' },
        { file: 'src/pages/session-history/index.ts', text: 'Skimmed.' },
        { file: 'src/elsewhere.ts', text: 'Not on the map.' },
      ],
    )
    expect(marks.responsibilities).toEqual({ [ESTIMATE]: 'Builds an estimate.' })
  })
})

describe('skimEntryFor', () => {
  const why = 'w'
  const match = (entry: string, path: string) =>
    skimEntryFor(path, [{ file: entry, why }])?.file

  it('matches a folder with a trailing slash', () => {
    expect(match('docs/', 'docs/a.md')).toBe('docs/')
  })

  it('matches a folder without a trailing slash, but not a longer name', () => {
    expect(match('src/pages/session-history', 'src/pages/session-history/index.ts')).toBe(
      'src/pages/session-history',
    )
    expect(match('src/app', 'src/application/x.ts')).toBeUndefined()
  })

  it('matches a glob', () => {
    expect(match('**/*.md', 'README.md')).toBe('**/*.md')
    expect(match('**/*.css', 'src/app/header.css')).toBe('**/*.css')
    expect(match('**/*.css', 'src/app/header.ts')).toBeUndefined()
  })

  it('matches an exact path, also written with ./', () => {
    expect(match('README.md', 'README.md')).toBe('README.md')
    expect(match('./README.md', 'README.md')).toBe('./README.md')
    expect(match('README.md', 'docs/README.md')).toBeUndefined()
  })

  it('takes the first entry that matches', () => {
    const found = skimEntryFor('docs/a.md', [
      { file: 'docs/', why: 'first' },
      { file: 'docs/a.md', why: 'second' },
    ])
    expect(found?.why).toBe('first')
  })
})
