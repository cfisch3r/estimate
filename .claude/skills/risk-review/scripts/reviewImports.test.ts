import { describe, expect, it } from 'vitest'
import {
  diffImports,
  importEdges,
  type ImportEdge,
  type SourceTree,
} from './reviewImports.ts'

// Small projects held in memory: each test names its files and reads the import edges the
// TypeScript checker finds between them.

const CONFIG = JSON.stringify({ compilerOptions: { strict: true }, include: ['src'] })

function tree(files: Record<string, string>): SourceTree {
  const all = { 'tsconfig.app.json': CONFIG, ...files }
  return { files: Object.keys(all), read: (path) => all[path as keyof typeof all] }
}

const edgesOf = (files: Record<string, string>) =>
  importEdges(tree(files), 'tsconfig.app.json')

const edge = (from: string, to: string, ...names: string[]): ImportEdge => ({
  from,
  to,
  names,
})

describe('importEdges', () => {
  it('finds a named import of the file that declares it', () => {
    expect(
      edgesOf({
        'src/a.ts': "import { b } from './b.ts'\nexport const a = b",
        'src/b.ts': 'export const b = 1',
      }),
    ).toEqual([edge('src/a.ts', 'src/b.ts', 'b')])
  })

  it('goes through a barrel to the file that declares the name', () => {
    expect(
      edgesOf({
        'src/ui/Form.tsx':
          "import { format } from '../domain/index.ts'\nexport const f = format",
        'src/domain/index.ts':
          "export { format } from './format.ts'\nexport * from './range.ts'",
        'src/domain/format.ts': 'export const format = 1',
        'src/domain/range.ts': 'export const range = 2',
      }),
    ).toEqual([
      edge('src/domain/index.ts', 'src/domain/format.ts', 'format'),
      edge('src/domain/index.ts', 'src/domain/range.ts', '*'),
      edge('src/ui/Form.tsx', 'src/domain/format.ts', 'format'),
    ])
  })

  it('follows export * and nested barrels too', () => {
    expect(
      edgesOf({
        'src/a.ts': "import { range } from './outer.ts'\nexport const a = range",
        'src/outer.ts': "export * from './inner.ts'",
        'src/inner.ts': "export * from './range.ts'",
        'src/range.ts': 'export const range = 2',
      }).filter((e) => e.from === 'src/a.ts'),
    ).toEqual([edge('src/a.ts', 'src/range.ts', 'range')])
  })

  it('counts type imports and default imports', () => {
    expect(
      edgesOf({
        'src/a.ts':
          "import type { T } from './t.ts'\nimport d from './d.ts'\nexport const a: T = d",
        'src/t.ts': 'export type T = number',
        'src/d.ts': 'export default 1',
      }),
    ).toEqual([
      edge('src/a.ts', 'src/d.ts', 'default'),
      edge('src/a.ts', 'src/t.ts', 'T'),
    ])
  })

  it('resolves the names used from a namespace import', () => {
    expect(
      edgesOf({
        'src/a.ts':
          "import * as d from './index.ts'\nexport const a = d.format + d.range",
        'src/index.ts': "export * from './format.ts'\nexport * from './range.ts'",
        'src/format.ts': 'export const format = 1',
        'src/range.ts': 'export const range = 2',
      }).filter((e) => e.from === 'src/a.ts'),
    ).toEqual([
      edge('src/a.ts', 'src/format.ts', 'format'),
      edge('src/a.ts', 'src/range.ts', 'range'),
    ])
  })

  it('joins the names one file takes from another', () => {
    expect(
      edgesOf({
        'src/a.ts':
          "import { y, x } from './b.ts'\nimport { z } from './b.ts'\nexport const a = x + y + z",
        'src/b.ts': 'export const x = 1, y = 2, z = 3',
      }),
    ).toEqual([edge('src/a.ts', 'src/b.ts', 'x', 'y', 'z')])
  })

  it('leaves out packages and files outside the project', () => {
    expect(
      edgesOf({
        'src/a.ts':
          "import { useState } from 'react'\nimport { s } from '../scripts/s.ts'\nexport const a = [useState, s]",
        'scripts/s.ts': "import { a } from '../src/a.ts'\nexport const s = a",
      }),
    ).toEqual([])
  })

  it('reads the include list of the configuration', () => {
    const files = {
      'tsconfig.app.json': JSON.stringify({ include: ['src/app', 'src/lib/b.ts'] }),
      'src/app/a.ts': "import { b } from '../lib/b.ts'\nexport const a = b",
      'src/lib/b.ts': "import { c } from './c.ts'\nexport const b = c",
      'src/lib/c.ts': 'export const c = 1',
    }
    const all: SourceTree = {
      files: Object.keys(files),
      read: (p) => files[p as keyof typeof files],
    }
    expect(importEdges(all, 'tsconfig.app.json')).toEqual([
      edge('src/app/a.ts', 'src/lib/b.ts', 'b'),
    ])
  })
})

describe('diffImports', () => {
  it('marks edges as added, removed or kept', () => {
    const base = [edge('a.ts', 'old.ts', 'f'), edge('a.ts', 'k.ts', 'k')]
    const head = [edge('a.ts', 'new.ts', 'f'), edge('a.ts', 'k.ts', 'k', 'k2')]
    expect(diffImports(base, head, new Map())).toEqual([
      { ...edge('a.ts', 'k.ts', 'k', 'k2'), status: 'kept' },
      { ...edge('a.ts', 'new.ts', 'f'), status: 'added' },
      { ...edge('a.ts', 'old.ts', 'f'), status: 'removed' },
    ])
  })

  it('follows moved files, so their imports are not removed and added again', () => {
    const base = [edge('old/a.ts', 'old/b.ts', 'b')]
    const head = [edge('new/a.ts', 'new/b.ts', 'b')]
    const moves = new Map([
      ['old/a.ts', 'new/a.ts'],
      ['old/b.ts', 'new/b.ts'],
    ])
    expect(diffImports(base, head, moves)).toEqual([
      { ...edge('new/a.ts', 'new/b.ts', 'b'), status: 'kept' },
    ])
  })
})
