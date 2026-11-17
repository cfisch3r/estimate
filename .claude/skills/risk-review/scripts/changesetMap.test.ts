/// <reference lib="dom" />
import { afterEach, describe, expect, it } from 'vitest'
import type { ChangedFile } from './changedDiff.ts'
import { renderMapSection } from './changesetMap.ts'
import { buildChangesetMap, type MapConfig } from './reviewMap.ts'

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
function open(files: ChangedFile[]) {
  const errors: string[] = []
  const onError = (e: ErrorEvent) => errors.push(e.message)
  window.addEventListener('error', onError)
  cleanups.push(() => window.removeEventListener('error', onError))
  document.body.innerHTML = renderMapSection(buildChangesetMap(files, config))
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
    const { boxes } = open(busySlice)
    const collapsed = document.querySelectorAll<HTMLElement>('.node.collapsed')
    expect(collapsed).toHaveLength(1)
    expect(collapsed[0]?.textContent).toContain('busy/model')
    collapsed[0]?.click()
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
    boxes()[0]?.click()
    expect(boxes()).toHaveLength(2)
  })

  it('disables the label of a single-file folder', () => {
    const { label } = open([
      added('src/features/one/a.ts'),
      added('src/features/two/a.ts'),
    ])
    expect(label('one').disabled).toBe(true)
    expect(label('one').textContent).not.toContain('▾')
  })

  it('shows the full path and status in the hover card', () => {
    const { boxes } = open([
      { path: 'src/features/y/A.tsx', oldPath: 'src/domain/x/A.tsx', status: 'renamed' },
    ])
    const moved = boxes().find(
      (b) => b.textContent === 'A.tsx' && b.classList.contains('moved'),
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
      [...document.querySelectorAll('#changeset-map .strip-file')].map(
        (f) => f.textContent,
      ),
    ).toEqual([
      'docs/technical/review-risk.md',
      '.claude/skills/risk-review/changeset-map.yaml',
    ])
  })

  it('counts the files left off the map in the legend', () => {
    open([added('src/domain/a.test.ts'), added('src/domain/a.ts')])
    expect(document.getElementById('changeset-map')?.textContent).toContain(
      '1 file left off the map',
    )
  })
})
