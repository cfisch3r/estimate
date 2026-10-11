// @vitest-environment node
/// <reference types="node" />
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'

// The layer rules in `.dependency-cruiser.cjs` can fail silently: an import the tool
// cannot resolve, or a type-only import, is missing from its graph, so no rule fires on
// it and `pnpm arch:layers` stays green. Each case below plants one violation in a
// throwaway project and checks that the named rule reports it.
const root = join(import.meta.dirname, '..')
const sandbox = mkdtempSync(join(root, '.layer-canary-'))

afterAll(() => rmSync(sandbox, { recursive: true, force: true }))

writeFileSync(
  join(sandbox, 'tsconfig.app.json'),
  JSON.stringify({
    compilerOptions: { module: 'esnext', moduleResolution: 'bundler', jsx: 'react-jsx' },
  }),
)

function write(file: string, source: string) {
  const path = join(sandbox, file)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, source)
}

write('src/adapters/network/session.ts', 'export const session = 1\n')
write('src/application/stores/session.ts', 'export const store = 1\n')

const cases: Array<{ rule: string; file: string; source: string }> = [
  {
    rule: 'R1-domain-imports-nothing-outside-itself',
    file: 'src/domain/value.ts',
    source: "import { useState } from 'react'\nexport const x = useState\n",
  },
  {
    rule: 'R1-domain-imports-nothing-outside-itself',
    file: 'src/domain/typeOnly.ts',
    source: "import type { ReactNode } from 'react'\nexport type X = ReactNode\n",
  },
  {
    rule: 'R2-application-no-router-or-transport',
    file: 'src/application/router.ts',
    source: "import { useNavigate } from 'react-router'\nexport const x = useNavigate\n",
  },
  {
    rule: 'R2-application-no-ui-no-adapter',
    file: 'src/application/adapter.ts',
    source:
      "import { session } from '../adapters/network/session'\nexport const x = session\n",
  },
  {
    rule: 'R3-adapters-application-only-outbound-ports',
    file: 'src/adapters/network/stores.ts',
    source:
      "import { store } from '../../application/stores/session'\nexport const x = store\n",
  },
  {
    rule: 'R5-ui-no-adapter',
    file: 'src/features/estimate/adapter.ts',
    source:
      "import { session } from '../../adapters/network/session'\nexport const x = session\n",
  },
  {
    rule: 'R5-ui-application-only-through-barrel',
    file: 'src/features/estimate/stores.ts',
    source:
      "import { store } from '../../application/stores/session'\nexport const x = store\n",
  },
  {
    rule: 'no-unresolvable-imports',
    file: 'src/shared/missing.ts',
    source: "import 'a-package-that-is-not-installed'\n",
  },
]

function violations(): string[] {
  try {
    execFileSync(
      join(root, 'node_modules/.bin/depcruise'),
      ['src', '--config', join(root, '.dependency-cruiser.cjs'), '--output-type', 'err'],
      { cwd: sandbox, encoding: 'utf-8', stdio: 'pipe' },
    )
    return []
  } catch (error) {
    return String((error as { stdout?: string }).stdout ?? error).split('\n')
  }
}

describe('layer rules', () => {
  it('report every planted violation under the rule that names it', () => {
    for (const { file, source } of cases) write(file, source)
    const output = violations()
    const missing = cases.filter(
      ({ rule, file }) =>
        !output.some((line) => line.includes(rule) && line.includes(file)),
    )
    expect(missing).toEqual([])
  })
})
