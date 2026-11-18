/// <reference lib="dom" />
import { afterEach, describe, expect, it } from 'vitest'
import type { ChangedFile } from './changedDiff.ts'
import { renderMapSection } from './changesetMap.ts'
import type { ImportChange } from './reviewImports.ts'
import { buildChangesetMap, type MapCode, type MapConfig } from './reviewMap.ts'
import type { Section } from './reviewSignals.ts'

// The map section runs its own small script in the page: it lays out the boxes from the
// embedded data and lets the reader collapse and open folders. These tests run the
// rendered section in jsdom, the way a browser would.

const config: MapConfig = {
  sourceRoot: 'src',
  layers: [
    { name: 'app', wholeSlice: true },
    { name: 'features', group: 'ui' },
    { name: 'shared', group: 'ui' },
    { name: 'domain' },
    { name: 'adapters', side: true },
  ],
  strips: [
    { name: 'Docs', paths: ['docs/**', '**/*.md'] },
    { name: 'Agent, CI and tooling', paths: ['.claude/**'] },
  ],
  offMap: ['**/*.test.ts'],
}

const added = (path: string): ChangedFile => ({ path, status: 'added' })

// Inserted markup does not run its scripts, so each one is replaced by a fresh copy, the
// way the browser runs them when it loads the page.
function open(files: ChangedFile[], imports: ImportChange[] | Section<MapCode> = []) {
  const errors: string[] = []
  const onError = (e: ErrorEvent) => errors.push(e.message)
  window.addEventListener('error', onError)
  cleanups.push(() => window.removeEventListener('error', onError))
  const section = Array.isArray(imports)
    ? { status: 'ok' as const, edges: imports }
    : imports
  document.body.innerHTML = renderMapSection(buildChangesetMap(files, config, section))
  for (const old of document.body.querySelectorAll('script:not([type])')) {
    const fresh = document.createElement('script')
    fresh.textContent = old.textContent
    old.replaceWith(fresh)
  }
  const boxes = () => [...document.querySelectorAll<HTMLElement>('#changeset-map .node')]
  const label = (text: string) => {
    const found = [...document.querySelectorAll<HTMLButtonElement>('.folder-label')].find(
      (b) => b.textContent?.startsWith(`${text}/`),
    )
    if (!found) throw new Error(`no folder label ${text}`)
    return found
  }
  return { errors, boxes, label }
}

const cleanups: Array<() => void> = []
afterEach(() => {
  cleanups.splice(0).forEach((c) => c())
  document.body.innerHTML = ''
})

const rect = (el: HTMLElement) => ({
  x: parseFloat(el.style.left),
  y: parseFloat(el.style.top),
  w: parseFloat(el.style.width),
  h: parseFloat(el.style.height),
})

const busySlice = ['a', 'b', 'c', 'd', 'e'].map((n) =>
  added(`src/features/busy/model/${n}.ts`),
)

describe('renderMapSection', () => {
  it('draws one box per file and none overlap', () => {
    const { boxes, errors } = open([
      added('src/app/App.tsx'),
      added('src/features/save/ui/Button.tsx'),
      added('src/features/save/model/save.ts'),
      { path: 'src/shared/ui/Card.tsx', status: 'modified' },
      { path: 'src/domain/round.ts', status: 'deleted' },
      added('src/adapters/file/download.ts'),
      added('src/adapters/file/upload.ts'),
    ])
    expect(errors).toEqual([])
    const all = boxes()
    expect(all).toHaveLength(7)
    const rects = all.map(rect)
    for (const [i, a] of rects.entries()) {
      for (const b of rects.slice(i + 1)) {
        const overlap =
          a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
        expect(overlap).toBe(false)
      }
    }
  })

  it('starts a busy slice collapsed', () => {
    const { boxes, label } = open(busySlice)
    const collapsed = document.querySelectorAll<HTMLElement>('.node.collapsed')
    expect(collapsed).toHaveLength(1)
    label('busy/model').click()
    expect(boxes()).toHaveLength(5)
    expect(document.querySelectorAll('.node.collapsed')).toHaveLength(0)
  })

  it('collapses and reopens a folder', () => {
    const { boxes, label } = open([
      added('src/features/save/ui/Button.tsx'),
      added('src/features/save/ui/Label.tsx'),
    ])
    expect(boxes()).toHaveLength(2)
    label('save/ui').click()
    expect(boxes()).toHaveLength(1)
    expect(boxes()[0]?.classList.contains('collapsed')).toBe(true)
    label('save/ui').click()
    expect(boxes()).toHaveLength(2)
  })

  it('names a single-file folder as plain text, not as a control', () => {
    open([added('src/features/one/a.ts'), added('src/features/two/a.ts')])
    const name = [...document.querySelectorAll('.folder-label')].find((e) =>
      e.textContent?.startsWith('one/'),
    )
    expect(name?.tagName).toBe('SPAN')
    expect(name?.textContent).not.toContain('▾')
  })

  it('tells a screen reader whether a folder is open and what a collapsed one holds', () => {
    const { label } = open([
      ...busySlice,
      added('src/features/save/ui/Button.tsx'),
      added('src/features/save/ui/Label.tsx'),
    ])
    const openName = label('save/ui')
    expect(openName.getAttribute('aria-expanded')).toBe('true')
    expect(openName.querySelector('[aria-hidden="true"]')?.textContent).toContain('▾')
    const closedName = label('busy/model')
    expect(closedName.getAttribute('aria-expanded')).toBe('false')
    expect(closedName.querySelector('[aria-hidden="true"]')?.textContent).toContain('▸')
    const collapsed = document.querySelector<HTMLElement>('.node.collapsed')
    expect(collapsed?.tagName).toBe('BUTTON')
    expect(collapsed?.textContent).toContain('5 added')
  })

  it('marks each file status with a sign, not by colour alone', () => {
    open([
      added('src/domain/a.ts'),
      { path: 'src/domain/b.ts', status: 'modified' },
      { path: 'src/domain/c.ts', status: 'deleted' },
      added('docs/x.md'),
    ])
    const signs = Object.fromEntries(
      [...document.querySelectorAll('#changeset-map .node')].map((b) => [
        b.querySelector('.name')?.textContent,
        b.querySelector('.sign')?.textContent,
      ]),
    )
    expect(signs).toEqual({ 'a.ts': '+', 'b.ts': '~', 'c.ts': '−' })
    expect(document.querySelector('.strip-file .sign')?.textContent).toBe('+')
    expect(document.querySelector('#changeset-map .legend')?.textContent).toContain(
      '+ added',
    )
  })

  it('hides the card when a folder is toggled', () => {
    const { label } = open(busySlice)
    const box = document.querySelector<HTMLElement>('.node.collapsed')
    box?.dispatchEvent(new MouseEvent('mouseenter'))
    expect(document.getElementById('map-card')?.hidden).toBe(false)
    label('busy/model').click()
    expect(document.getElementById('map-card')?.hidden).toBe(true)
  })

  it('keeps the card inside the map for a box at the right edge', () => {
    const { boxes } = open([added('src/adapters/file/download.ts')])
    boxes()[0]?.dispatchEvent(new MouseEvent('mouseenter'))
    const card = document.getElementById('map-card') as HTMLElement
    expect(parseFloat(card.style.left) + 360).toBeLessThanOrEqual(1240)
  })

  it('puts the heading inside the section it names', () => {
    open([added('src/domain/a.ts')])
    const section = document.getElementById('changeset-map')
    const heading = section?.querySelector('h2')
    expect(heading?.textContent).toBe('Changeset map')
    expect(section?.getAttribute('aria-labelledby')).toBe(heading?.id)
  })

  it('shows the full path and status in the hover card', () => {
    const { boxes } = open([
      { path: 'src/features/y/A.tsx', oldPath: 'src/domain/x/A.tsx', status: 'renamed' },
    ])
    const moved = boxes().find(
      (b) =>
        b.querySelector('.name')?.textContent === 'A.tsx' &&
        b.classList.contains('moved'),
    )
    moved?.dispatchEvent(new MouseEvent('mouseenter'))
    const card = document.getElementById('map-card')
    expect(card?.hidden).toBe(false)
    expect(card?.textContent).toContain('src/features/y/A.tsx')
    expect(card?.textContent).toContain('moved from src/domain/x/A.tsx')
    expect(boxes().some((b) => b.classList.contains('ghost'))).toBe(true)
  })

  it('renders a file name with markup as text', () => {
    const { boxes } = open([added('src/domain/<img src=x onerror=alert(1)>.ts')])
    expect(document.querySelector('img')).toBeNull()
    expect(boxes()[0]?.textContent).toContain('<img')
  })

  it('keeps the data block intact for a path containing </script>', () => {
    const path = 'src/domain/</script><script>alert(1)</script>.ts'
    const { errors } = open([added(path)])
    const blocks = document.querySelectorAll('#changeset-map-data')
    expect(blocks).toHaveLength(1)
    expect(
      JSON.parse(blocks[0]?.textContent ?? '').layers[3].root.folders[0].files[0].path,
    ).toBe(path)
    expect(errors).toEqual([])
  })

  it('shows strips and empty layers for a branch outside src', () => {
    const { boxes, errors } = open([
      added('.claude/skills/risk-review/changeset-map.yaml'),
      added('docs/technical/review-risk.md'),
    ])
    expect(errors).toEqual([])
    expect(boxes()).toHaveLength(0)
    expect(
      [...document.querySelectorAll<HTMLElement>('#changeset-map .strip-file')].map(
        (f) =>
          `${f.querySelector('.dir')?.textContent}${f.querySelector('.name')?.textContent}`,
      ),
    ).toEqual([
      'docs/technical/review-risk.md',
      '.claude/skills/risk-review/changeset-map.yaml',
    ])
  })

  it('keeps the file name of a strip row whole and shortens its folder instead', () => {
    open([added('docs/technical/adr/002-testing-strategy.md')])
    const row = document.querySelector<HTMLElement>('#changeset-map .strip-file')
    const dir = row?.querySelector<HTMLElement>('.dir')
    const name = row?.querySelector<HTMLElement>('.name')
    expect(dir?.textContent).toBe('docs/technical/adr/')
    expect(name?.textContent).toBe('002-testing-strategy.md')
    expect(getComputedStyle(name as HTMLElement).flexShrink).toBe('0')
    expect(getComputedStyle(dir as HTMLElement).textOverflow).toBe('ellipsis')
  })

  it('lets clicks through the frames to the folder names below them', () => {
    open([
      added('src/features/save/ui/Button.tsx'),
      added('src/features/save/ui/Label.tsx'),
    ])
    for (const frame of document.querySelectorAll(
      '.group-frame, .layer-frame, .folder-frame',
    )) {
      expect(getComputedStyle(frame).pointerEvents).toBe('none')
    }
  })

  it('keeps keyboard focus on the name of the folder it opened or collapsed', () => {
    const { label } = open(busySlice)
    label('busy/model').focus()
    label('busy/model').click()
    const opened = document.activeElement as HTMLElement
    expect(opened.classList.contains('folder-label')).toBe(true)
    expect(opened.getAttribute('aria-expanded')).toBe('true')
    expect(opened.dataset.path).toBe('src/features/busy/model')
    opened.click()
    const closed = document.activeElement as HTMLElement
    expect(closed.classList.contains('folder-label')).toBe(true)
    expect(closed.getAttribute('aria-expanded')).toBe('false')
    expect(closed.dataset.path).toBe('src/features/busy/model')
  })

  it('writes each status colour once for both themes', () => {
    open([added('src/domain/a.ts')])
    const style = document.querySelector('#changeset-map style')?.textContent ?? ''
    expect(style).toMatch(/--add:\s*light-dark\(#1a7f37,\s*#3fb950\)/)
    expect(style).not.toContain('prefers-color-scheme')
  })

  it('counts the files left off the map in the legend', () => {
    open([added('src/domain/a.test.ts'), added('src/domain/a.ts')])
    expect(document.getElementById('changeset-map')?.textContent).toContain(
      '1 file left off the map',
    )
  })
})

describe('import arrows', () => {
  const imp = (
    from: string,
    to: string,
    status: ImportChange['status'],
    ...names: string[]
  ): ImportChange => ({ from, to, status, names: names.length ? names : ['x'] })
  const FORM = 'src/features/form/ui/Form.tsx'
  const FMT = 'src/domain/format.ts'
  const DAYS = 'src/domain/days.ts'
  const files = [
    { path: FORM, status: 'modified' as const },
    added(FMT),
    { path: DAYS, status: 'deleted' as const },
  ]
  const edges = [
    imp(FORM, FMT, 'added', 'formatRange'),
    imp(FORM, DAYS, 'removed', 'formatDays'),
    imp(FORM, 'src/domain/estimate.ts', 'kept', 'createEstimate'),
  ]
  const arrows = (kind?: string) => [
    ...document.querySelectorAll<SVGPathElement>(
      `#changeset-map .edges path.edge${kind ? `.${kind}` : ''}`,
    ),
  ]
  const box = (name: string) => {
    const found = [
      ...document.querySelectorAll<HTMLElement>('#changeset-map .node'),
    ].find((b) => b.querySelector('.name')?.textContent === name)
    if (!found) throw new Error(`no box ${name}`)
    return found
  }
  const tick = (kind: string, on: boolean) => {
    const input = document.querySelector<HTMLInputElement>(
      `#changeset-map input[data-show="${kind}"]`,
    )
    if (!input) throw new Error(`no checkbox ${kind}`)
    input.checked = on
    input.dispatchEvent(new Event('change'))
  }
  const card = () => document.getElementById('map-card') as HTMLElement

  it('draws the added and removed imports between boxes, and the kept ones only on focus', () => {
    const { errors } = open(files, edges)
    expect(errors).toEqual([])
    expect(arrows('added')).toHaveLength(1)
    expect(arrows('removed')).toHaveLength(1)
    expect(arrows('kept')).toHaveLength(0)
  })

  it('draws an unchanged file an import points at as a box of its own', () => {
    open(files, [imp(FORM, 'src/domain/estimate.ts', 'added')])
    const context = box('estimate.ts')
    expect(context.classList.contains('context')).toBe(true)
    expect(context.querySelector('.sign')?.textContent).toBe('·')
    expect(arrows('added')).toHaveLength(1)
  })

  it('hides a kind of arrow with its legend checkbox', () => {
    open(files, edges)
    tick('added', false)
    expect(arrows('added')).toHaveLength(0)
    expect(arrows('removed')).toHaveLength(1)
    tick('removed', false)
    expect(arrows()).toHaveLength(0)
    tick('added', true)
    expect(arrows('added')).toHaveLength(1)
  })

  it("shows a hovered box's own imports whatever the checkboxes say", () => {
    open(files, edges)
    tick('added', false)
    tick('removed', false)
    box('Form.tsx').dispatchEvent(new MouseEvent('mouseenter'))
    expect(arrows('added')).toHaveLength(1)
    expect(arrows('removed')).toHaveLength(1)
    box('Form.tsx').dispatchEvent(new MouseEvent('mouseleave'))
    expect(arrows()).toHaveLength(0)
  })

  it('shows only the imports of the focused box and fades the others', () => {
    open(
      [...files, { path: 'src/features/other/ui/Other.tsx', status: 'modified' }],
      [...edges, imp('src/features/other/ui/Other.tsx', FMT, 'added')],
    )
    box('format.ts').dispatchEvent(new MouseEvent('mouseenter'))
    expect(arrows('kept')).toHaveLength(0)
    expect(arrows().every((a) => a.classList.contains('dim'))).toBe(true)
    box('Form.tsx').dispatchEvent(new MouseEvent('mouseenter'))
    expect(arrows('kept')).toHaveLength(0)
    expect(arrows().filter((a) => !a.classList.contains('dim'))).toHaveLength(2)
  })

  it('draws an arrow to a file on the map in gray when it is kept', () => {
    open(
      files,
      [...edges, imp(FORM, FMT, 'kept')].filter((e) => e.status !== 'added'),
    )
    box('Form.tsx').dispatchEvent(new MouseEvent('mouseenter'))
    expect(arrows('kept')).toHaveLength(1)
  })

  it('pins a box with a click and unpins it with a second click or Escape', () => {
    open(files, edges)
    tick('added', false)
    const form = box('Form.tsx')
    form.click()
    form.dispatchEvent(new MouseEvent('mouseleave'))
    expect(form.getAttribute('aria-pressed')).toBe('true')
    expect(card().hidden).toBe(false)
    expect(arrows('added')).toHaveLength(1)
    box('Form.tsx').click()
    expect(box('Form.tsx').getAttribute('aria-pressed')).toBe('false')
    expect(card().hidden).toBe(true)
    box('Form.tsx').click()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(box('Form.tsx').getAttribute('aria-pressed')).toBe('false')
    expect(arrows('added')).toHaveLength(0)
  })

  it("lists the box's imports with the names they use in its card", () => {
    open(files, edges)
    box('Form.tsx').dispatchEvent(new MouseEvent('mouseenter'))
    const text = card().textContent ?? ''
    expect(text).toContain('Imports added (1)')
    expect(text).toContain('domain/format.ts')
    expect(text).toContain('formatRange')
    expect(text).toContain('Imports removed (1)')
    expect(text).toContain('formatDays')
    expect(text).toContain('Imports kept (1)')
    expect(text).toContain('domain/estimate.ts · not on the map')
    expect(text).not.toContain('imported by')
  })

  it('joins the arrows of a collapsed folder and counts them', () => {
    const busy = busySlice.map((f) => f.path)
    open(
      [...busySlice, added(FMT)],
      [imp(busy[0] as string, FMT, 'added'), imp(busy[1] as string, FMT, 'added')],
    )
    expect(arrows('added')).toHaveLength(1)
    expect(document.querySelector('#changeset-map .edge-count')?.textContent).toBe('2')
  })

  it('pins a collapsed folder with a click on the box, and opens it only by its name', () => {
    const { boxes, label } = open(
      [...busySlice, added(FMT)],
      [imp(busySlice[0]?.path as string, FMT, 'added')],
    )
    const collapsed = document.querySelector<HTMLElement>(
      '.node.collapsed',
    ) as HTMLElement
    collapsed.click()
    expect(boxes()).toHaveLength(2)
    expect(collapsed.getAttribute('aria-pressed')).toBe('true')
    expect(card().textContent).toContain('a.ts → domain/format.ts')
    label('busy/model').click()
    expect(boxes()).toHaveLength(6)
  })

  it('names the import arrows in the legend with their counts', () => {
    open(files, edges)
    const legend = document.querySelector('#changeset-map .legend')?.textContent ?? ''
    expect(legend).toContain('added imports (1)')
    expect(legend).toContain('removed imports (1)')
    expect(legend).toContain('click to pin it')
    expect(legend).toContain('· unchanged, at a changed import')
  })

  it('says in the legend why the arrows are missing', () => {
    open(files, {
      status: 'not available',
      reason: 'reading the imports failed: bad object',
    })
    expect(arrows()).toHaveLength(0)
    expect(document.querySelector('#changeset-map .legend')?.textContent).toContain(
      'import arrows not available: reading the imports failed: bad object',
    )
    expect(document.querySelector('#changeset-map input[data-show]')).toBeNull()
  })

  it('counts only the imports that are drawn as arrows in the legend', () => {
    open(files, [...edges, imp(FORM, 'src/domain/types.test.ts', 'added')])
    expect(document.querySelector('#changeset-map .legend')?.textContent).toContain(
      'added imports (1)',
    )
  })

  it("keeps a collapsed folder's card open while the pointer is on its name", () => {
    const { label } = open(
      [...busySlice, added(FMT)],
      [imp(busySlice[0]?.path as string, FMT, 'added')],
    )
    const collapsed = document.querySelector<HTMLElement>(
      '.node.collapsed',
    ) as HTMLElement
    collapsed.dispatchEvent(new MouseEvent('mouseenter'))
    collapsed.dispatchEvent(new MouseEvent('mouseleave'))
    label('busy/model').dispatchEvent(new MouseEvent('mouseenter'))
    expect(card().hidden).toBe(false)
    expect(card().textContent).toContain('features/busy/model/')
  })

  it('describes the box with a short summary of its card for a screen reader', () => {
    open(files, edges)
    box('Form.tsx').focus()
    expect(box('Form.tsx').getAttribute('aria-describedby')).toBe('map-card-summary')
    expect(document.getElementById('map-card-summary')?.textContent).toBe(
      'changed; imports: 1 added, 1 removed, 1 kept',
    )
    expect(box('format.ts').hasAttribute('aria-describedby')).toBe(false)
    box('Form.tsx').blur()
    expect(box('Form.tsx').hasAttribute('aria-describedby')).toBe(false)
  })

  it('closes a card opened by hover or focus with Escape', () => {
    open(files, edges)
    box('Form.tsx').dispatchEvent(new MouseEvent('mouseenter'))
    expect(card().hidden).toBe(false)
    box('Form.tsx').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    )
    expect(card().hidden).toBe(true)
    box('Form.tsx').dispatchEvent(new MouseEvent('mouseenter'))
    expect(card().hidden).toBe(false)
  })

  it('keeps the card of the focused box when the pointer passes over another one', () => {
    open(files, edges)
    box('Form.tsx').focus()
    box('format.ts').dispatchEvent(new MouseEvent('mouseenter'))
    box('format.ts').dispatchEvent(new MouseEvent('mouseleave'))
    expect(card().hidden).toBe(false)
    expect(card().textContent).toContain('features/form/ui/Form.tsx')
  })

  it("names every folder button with the folder's full path", () => {
    const { label } = open([
      ...busySlice,
      added('src/features/save/ui/Button.tsx'),
      added('src/features/save/ui/Label.tsx'),
    ])
    expect(label('busy/model').getAttribute('aria-label')).toBe(
      'src/features/busy/model/',
    )
    expect(label('save/ui').getAttribute('aria-label')).toBe('src/features/save/ui/')
  })
})

describe('reach', () => {
  const B = 'src/domain/e/b.ts'
  const IDX = 'src/domain/e/index.ts'
  const A = 'src/features/x/ui/A.tsx'
  const C = 'src/features/c/ui/C.tsx'
  const S = 'src/shared/lib/s.ts'
  const edge = (
    from: string,
    to: string,
    status: ImportChange['status'],
    ...names: string[]
  ): ImportChange => ({ from, to, status, names })
  const files: ChangedFile[] = [
    { path: B, status: 'modified' },
    { path: IDX, status: 'modified' },
    { path: C, status: 'modified' },
  ]
  const code: Section<MapCode> = {
    status: 'ok',
    edges: [edge(A, B, 'kept', 'b'), edge(C, S, 'added', 's'), edge(S, B, 'kept', 'b')],
    exports: {
      [B]: [{ name: 'b', change: 'changed', via: 'h' }, { name: 'c' }],
      [IDX]: [{ name: 'b' }],
    },
    barrels: { [IDX]: { added: ['x', 'y'], removed: [] } },
    docs: { [A]: 'The A file.' },
  }
  const box = (name: string) => {
    const found = [
      ...document.querySelectorAll<HTMLElement>('#changeset-map .node'),
    ].find((b) => b.querySelector('.name')?.textContent === name)
    if (!found) throw new Error(`no box ${name}`)
    return found
  }
  const importers = (on: boolean) => {
    const input = document.getElementById('show-importers') as HTMLInputElement
    input.checked = on
    input.dispatchEvent(new Event('change'))
  }
  const hover = (name: string) => box(name).dispatchEvent(new MouseEvent('mouseenter'))
  const card = () => document.getElementById('map-card')?.textContent ?? ''
  const uses = (lit = false) => [
    ...document.querySelectorAll(
      `#changeset-map .edges path.edge.uses${lit ? ':not(.dim)' : ''}`,
    ),
  ]

  it('groups the legend into Boxes, Show and Marks rows', () => {
    open(files, code)
    const rows = [...document.querySelectorAll('#changeset-map .legend .lg-row')]
    expect(rows.map((r) => r.querySelector('.lg-h')?.textContent)).toEqual([
      'Boxes',
      'Show',
      'Marks',
    ])
    expect(rows[1]?.querySelectorAll('input[type="checkbox"]')).toHaveLength(3)
    expect(rows[1]?.textContent).toContain('unchanged importers (2)')
  })

  it('starts with the importer boxes hidden and shows them with the checkbox', () => {
    const { errors } = open(files, code)
    expect(document.querySelectorAll('#changeset-map .node.importer')).toHaveLength(0)
    importers(true)
    expect(errors).toEqual([])
    expect(box('A.tsx').classList).toContain('importer')
    expect(box('A.tsx').querySelector('.sign')?.textContent).toBe('◦')
  })

  it('draws every uses arrow while the checkbox is on and fades the others for the active box', () => {
    open(files, code)
    expect(uses()).toHaveLength(0)
    importers(true)
    expect(uses()).toHaveLength(2)
    hover('A.tsx')
    expect(uses(true)).toHaveLength(1)
    hover('b.ts')
    expect(uses(true)).toHaveLength(2)
  })

  it('draws a uses arrow instead of the kept arrow between the same two boxes', () => {
    open(files, code)
    importers(true)
    hover('A.tsx')
    expect(
      document.querySelectorAll('#changeset-map .edges path.edge.kept'),
    ).toHaveLength(0)
  })

  it('shows ↗n on a changed box and says it to a screen reader', () => {
    open(files, code)
    expect(box('b.ts').querySelector('.reach')?.textContent).toBe('↗2')
    expect(box('b.ts').getAttribute('aria-label')).toMatch(/used by 2 unchanged files$/)
    expect(box('index.ts').querySelector('.reach')).toBeNull()
  })

  it('shows the API chip beside the folder name inside the frame, and tells a screen reader', () => {
    open(files, code)
    const chip = document.querySelector<HTMLElement>('#changeset-map .api-chip')
    expect(chip?.querySelector('[aria-hidden="true"]')?.textContent).toBe('API +2 −0')
    expect(chip?.textContent).toContain('public API: 2 added, 0 removed')
    const frame = [
      ...document.querySelectorAll<HTMLElement>('#changeset-map .folder-frame'),
    ].find(
      (f) =>
        parseFloat(f.style.left) <= parseFloat(chip?.style.left ?? '0') &&
        parseFloat(f.style.top) + 10 > parseFloat(chip?.style.top ?? '0'),
    ) as HTMLElement
    const chipRight = parseFloat(chip?.style.left ?? '0') + 'API +2 −0'.length * 6 + 12
    expect(chipRight).toBeLessThanOrEqual(
      parseFloat(frame.style.left) + parseFloat(frame.style.width),
    )
  })

  it('puts the API chip of a collapsed folder in its box, below the name', () => {
    const { label } = open(files, code)
    label('e').click()
    const folder = document.querySelector<HTMLElement>(
      '#changeset-map .node[data-key="src/domain/e"]',
    )
    expect(folder?.querySelector('.chips .api-chip')?.textContent).toBe('API +2 −0')
    expect(folder?.getAttribute('aria-label')).toContain('public API: 2 added, 0 removed')
  })

  it("lists only the changed exports of each file in a collapsed folder's card", () => {
    const { label } = open(files, code)
    label('e').click()
    document
      .querySelector('#changeset-map .node[data-key="src/domain/e"]')
      ?.dispatchEvent(new MouseEvent('mouseenter'))
    expect(card()).toContain('b.ts: Changed exports (1)')
    expect(card()).not.toContain('index.ts:')
  })

  it('names the Show row as the group of its checkboxes and hides the mark samples', () => {
    open(files, code)
    const row = document.querySelectorAll('#changeset-map .lg-row')[1] as HTMLElement
    expect(row.getAttribute('role')).toBe('group')
    const heading = document.getElementById(row.getAttribute('aria-labelledby') ?? '')
    expect(heading?.textContent).toBe('Show')
    for (const sample of document.querySelectorAll(
      '#changeset-map .reach-sample, #changeset-map .api-sample',
    ))
      expect(sample.getAttribute('aria-hidden')).toBe('true')
  })

  it('lists an added import that is also a use in the card', () => {
    const F = 'src/features/y/ui/F.tsx'
    open(files, {
      ...code,
      status: 'ok',
      edges: [edge(F, B, 'added', 'b')],
    } as Section<MapCode>)
    importers(true)
    hover('F.tsx')
    expect(card()).toContain('Imports added (1)')
  })

  it('lists the exports, changed ones in bold, and the unchanged users in the card', () => {
    open(files, code)
    hover('b.ts')
    expect(card()).toContain('Exports (2, 1 changed)')
    expect(document.querySelector('#map-card b')?.textContent).toBe('b')
    expect(card()).toContain('changed via h')
    expect(card()).toContain('Used by, unchanged (2)')
    expect(card()).toContain('features/x/ui/A.tsx')
  })

  it("shows an importer's doc comment and what it uses in its card", () => {
    open(files, code)
    importers(true)
    hover('A.tsx')
    expect(card()).toContain('Doc comment')
    expect(card()).toContain('The A file.')
    expect(card()).toContain('Uses changed exports (1)')
    expect(card()).toContain('domain/e/b.ts')
  })

  it('draws a file that is both a context box and an importer white while the checkbox is on', () => {
    open(files, code)
    expect(box('s.ts').classList).toContain('context')
    importers(true)
    expect(box('s.ts').classList).toContain('importer')
    hover('s.ts')
    expect(card()).toContain(
      'an import of it was added or removed, and it uses a changed export',
    )
  })

  it('keeps a pin when the checkbox redraws the map', () => {
    open(files, code)
    box('b.ts').click()
    importers(true)
    expect(box('b.ts').getAttribute('aria-pressed')).toBe('true')
  })
})
