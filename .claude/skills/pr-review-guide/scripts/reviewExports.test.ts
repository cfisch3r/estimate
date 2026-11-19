import { describe, expect, it } from 'vitest'
import { diffExports } from './reviewExports.ts'
import { programFacts, type ProgramFacts } from './reviewImports.ts'

// Two small projects held in memory, the base and the change, compared export by export.

const CONFIG = JSON.stringify({ include: ['src'] })

function facts(files: Record<string, string>): ProgramFacts {
  const all = { 'tsconfig.app.json': CONFIG, ...files }
  return programFacts(
    { files: Object.keys(all), read: (path) => all[path as keyof typeof all] },
    'tsconfig.app.json',
  )
}

const diff = (
  base: Record<string, string>,
  head: Record<string, string>,
  changed: string[],
  moves = new Map<string, string>(),
) => diffExports(facts(base), facts(head), moves, new Set(changed))

describe('diffExports', () => {
  it('finds an export changed through a same-file helper', () => {
    const { exports } = diff(
      { 'src/a.ts': 'const h = 1\nexport const a = () => h' },
      { 'src/a.ts': 'const h = 2\nexport const a = () => h' },
      ['src/a.ts'],
    )
    expect(exports['src/a.ts']).toEqual([{ name: 'a', change: 'changed', via: 'h' }])
  })

  it('follows helpers more than one step', () => {
    const { exports } = diff(
      { 'src/a.ts': 'const c = 1\nconst b = () => c\nexport const a = () => b()' },
      { 'src/a.ts': 'const c = 2\nconst b = () => c\nexport const a = () => b()' },
      ['src/a.ts'],
    )
    expect(exports['src/a.ts']).toEqual([{ name: 'a', change: 'changed', via: 'c' }])
  })

  it('does not count a doc-comment-only change', () => {
    const { exports } = diff(
      { 'src/a.ts': 'export const a = 1' },
      { 'src/a.ts': '/** The answer. */\nexport const a = 1' },
      ['src/a.ts'],
    )
    expect(exports['src/a.ts']).toEqual([{ name: 'a' }])
  })

  it('counts a type-only change and a default export', () => {
    const { exports } = diff(
      { 'src/a.ts': 'export type T = number\nexport default 1' },
      { 'src/a.ts': 'export type T = string\nexport default 2' },
      ['src/a.ts'],
    )
    expect(exports['src/a.ts']).toEqual([
      { name: 'default', change: 'changed' },
      { name: 'T', change: 'changed' },
    ])
  })

  it('marks added and removed exports', () => {
    const { exports } = diff(
      { 'src/a.ts': 'export const a = 1\nexport const b = 2' },
      { 'src/a.ts': 'export const a = 1\nexport const c = 3' },
      ['src/a.ts'],
    )
    expect(exports['src/a.ts']).toEqual([
      { name: 'a' },
      { name: 'b', change: 'removed' },
      { name: 'c', change: 'added' },
    ])
  })

  it('removes every export of a deleted file', () => {
    const { exports } = diff(
      { 'src/a.ts': 'export const a = 1', 'src/b.ts': 'export const b = 1' },
      { 'src/b.ts': 'export const b = 1' },
      ['src/a.ts'],
    )
    expect(exports).toEqual({ 'src/a.ts': [{ name: 'a', change: 'removed' }] })
  })

  it('adds every export of an added file', () => {
    const { exports } = diff({}, { 'src/a.ts': 'export const a = 1' }, ['src/a.ts'])
    expect(exports).toEqual({ 'src/a.ts': [{ name: 'a', change: 'added' }] })
  })

  it('follows a moved file', () => {
    const { exports } = diff(
      { 'src/old/a.ts': 'export const a = 1' },
      { 'src/new/a.ts': 'export const a = 1' },
      ['src/new/a.ts'],
      new Map([['src/old/a.ts', 'src/new/a.ts']]),
    )
    expect(exports).toEqual({ 'src/new/a.ts': [{ name: 'a' }] })
  })

  it('sees a change to any of several statements that declare the same name', () => {
    const { exports } = diff(
      {
        'src/a.ts':
          'export function f(a: string): void\nexport function f(a: unknown) {}\nexport const S = { a: 1 } as const\nexport type S = typeof S',
      },
      {
        'src/a.ts':
          'export function f(a: number): void\nexport function f(a: unknown) {}\nexport const S = { a: 2 } as const\nexport type S = typeof S',
      },
      ['src/a.ts'],
    )
    expect(exports['src/a.ts']).toEqual([
      { name: 'f', change: 'changed' },
      { name: 'S', change: 'changed' },
    ])
  })

  it("diffs a barrel's re-exports and leaves out barrels that did not change", () => {
    const x = 'export const x = 1, y = 2'
    const { barrels, exports } = diff(
      {
        'src/d/x.ts': x,
        'src/d/index.ts': "export { x } from './x.ts'",
        'src/e/index.ts': "export { x } from '../d/x.ts'",
      },
      {
        'src/d/x.ts': x,
        'src/d/index.ts': "export { x, y } from './x.ts'",
        'src/e/index.ts': "export { x } from '../d/x.ts'",
      },
      ['src/d/index.ts'],
    )
    expect(barrels).toEqual({ 'src/d/index.ts': { added: ['y'], removed: [] } })
    expect(exports['src/d/index.ts']).toEqual([
      { name: 'x' },
      { name: 'y', change: 'added' },
    ])
  })
})
