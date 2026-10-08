import { describe, expect, it } from 'vitest'

// `vi.mock` of a path that no longer exists does not fail loudly and `tsc` cannot see it,
// so a stale mock silently stops mocking anything after a file move.
const tests = import.meta.glob<string>('/src/**/*.test.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
})
const modules = new Set(Object.keys(import.meta.glob('/src/**/*.{ts,tsx}')))

function resolveFrom(file: string, spec: string): string {
  const parts = file.split('/').slice(0, -1)
  for (const segment of spec.split('/')) {
    if (segment === '..') parts.pop()
    else if (segment !== '.') parts.push(segment)
  }
  return parts.join('/')
}

function exists(file: string, spec: string): boolean {
  const base = resolveFrom(file, spec)
  return ['', '.ts', '.tsx', '/index.ts', '/index.tsx'].some((ext) =>
    modules.has(base + ext),
  )
}

describe('vi.mock paths', () => {
  it('every relative vi.mock target resolves to a real module', () => {
    const stale: string[] = []
    for (const [file, source] of Object.entries(tests)) {
      for (const match of source.matchAll(/vi\.(?:do)?[mM]ock\(\s*['"](\.[^'"]*)['"]/g)) {
        const spec = match[1]
        if (spec && !exists(file, spec)) stale.push(`${file}: ${spec}`)
      }
    }
    expect(stale).toEqual([])
  })
})
