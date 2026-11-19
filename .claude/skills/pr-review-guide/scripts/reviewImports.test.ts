import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  diffImports,
  importEdges,
  programFacts,
  readCodeChanges,
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
      {
        ...edge('src/domain/index.ts', 'src/domain/format.ts', 'format'),
        reexports: ['format'],
      },
      { ...edge('src/domain/index.ts', 'src/domain/range.ts', '*'), reexports: ['*'] },
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

  it('keeps a namespace import that is only used as a whole', () => {
    expect(
      edgesOf({
        'src/a.ts': "import * as b from './b.ts'\nexport const a = [b]",
        'src/b.ts': 'export const x = 1',
      }),
    ).toEqual([edge('src/a.ts', 'src/b.ts', '*')])
  })

  it('counts a namespace used both as a whole and by member as a whole use', () => {
    expect(
      edgesOf({
        'src/a.ts': "import * as b from './b.ts'\nexport const a = [b, b.x]",
        'src/b.ts': 'export const x = 1',
      }),
    ).toEqual([edge('src/a.ts', 'src/b.ts', '*', 'x')])
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

const factsOf = (files: Record<string, string>) =>
  programFacts(tree(files), 'tsconfig.app.json')

describe('programFacts', () => {
  it('marks the names an edge only re-exports', () => {
    const { edges } = factsOf({
      'src/a.ts': "import { b } from './b.ts'\nexport { b }\nexport { c } from './b.ts'",
      'src/b.ts': 'export const b = 1, c = 2',
      'src/u.ts': "import { b } from './b.ts'\nexport const u = b",
    })
    expect(edges).toEqual([
      { ...edge('src/a.ts', 'src/b.ts', 'b', 'c'), reexports: ['c'] },
      edge('src/u.ts', 'src/b.ts', 'b'),
    ])
  })

  it('keys each export by its declaration and leaves re-exports null', () => {
    const { files } = factsOf({
      'src/a.ts':
        "export const x = 1, y = 2\nexport function f() { return x }\nexport { b } from './b.ts'",
      'src/b.ts': 'export const b = 1',
    })
    expect(files['src/a.ts']?.exports).toEqual({ x: 'x,y', y: 'x,y', f: 'f', b: null })
  })

  it('keys an anonymous default export as default', () => {
    const { files } = factsOf({ 'src/a.ts': 'export default 1' })
    expect(files['src/a.ts']?.exports).toEqual({ default: 'default' })
  })

  it('prints a declaration without comments or formatting', () => {
    const one = factsOf({ 'src/a.ts': 'export function f() { return 1 }' })
    const two = factsOf({
      'src/a.ts': '/** Says one. */\nexport function f()   {\n  // one\n  return 1\n}',
    })
    expect(two.files['src/a.ts']?.declarations['f']?.text).toBe(
      one.files['src/a.ts']?.declarations['f']?.text,
    )
  })

  it('lists the same-file declarations a declaration uses', () => {
    const { files } = factsOf({
      'src/a.ts': 'const h = 1\nfunction g() { return h }\nexport const a = g()',
    })
    const declarations = files['src/a.ts']?.declarations
    expect(declarations?.['a']?.deps).toEqual(['g'])
    expect(declarations?.['g']?.deps).toEqual(['h'])
    expect(declarations?.['h']?.deps).toEqual([])
  })

  it("reads the file's leading doc comment", () => {
    const { files } = factsOf({
      'src/a.ts': '/**\n * The store:\n * items and estimates.\n */\nexport const s = 1',
      'src/b.ts': '// note\nexport const b = 1',
    })
    expect(files['src/a.ts']?.doc).toBe('The store: items and estimates.')
    expect(files['src/b.ts']?.doc).toBeUndefined()
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

describe('readCodeChanges', () => {
  it('reads the import and export changes of a repository in one pass', () => {
    const dir = mkdtempSync(join(tmpdir(), 'code-changes-'))
    try {
      const git = (...args: string[]) =>
        execFileSync(
          'git',
          [
            '-c',
            'user.name=t',
            '-c',
            'user.email=t@t',
            '-c',
            'core.hooksPath=/dev/null',
            ...args,
          ],
          { cwd: dir, stdio: 'ignore' },
        )
      const write = (path: string, text: string) => {
        mkdirSync(join(dir, path, '..'), { recursive: true })
        writeFileSync(join(dir, path), text)
      }
      write('tsconfig.app.json', CONFIG)
      write('src/a.ts', "import { b } from './b.ts'\nexport const a = b")
      write('src/b.ts', '/** The b file. */\nexport const b = 1')
      git('init', '-q')
      git('add', '.')
      git('commit', '-qm', 'base')
      write('src/b.ts', '/** The b file. */\nexport const b = 2')

      const changes = readCodeChanges(dir, 'HEAD', new Map(), new Set(['src/b.ts']))
      expect(changes.edges).toEqual([
        { ...edge('src/a.ts', 'src/b.ts', 'b'), status: 'kept' },
      ])
      expect(changes.exports).toEqual({ 'src/b.ts': [{ name: 'b', change: 'changed' }] })
      expect(changes.barrels).toEqual({})
      expect(changes.docs).toEqual({ 'src/b.ts': 'The b file.' })
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
