// @vitest-environment node
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'

// The layer rules in `.dependency-cruiser.cjs` can fail silently: an import the tool
// cannot resolve, or a type-only import, is missing from its graph, so no rule fires on
// it and `pnpm arch:layers` stays green. Each case below plants one violation in a
// throwaway project and checks that the named rule reports it. The "allowed" cases check
// the test-file exceptions the other way round: they must not be reported.
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

// Targets the planted imports point at.
write('src/adapters/network/session.ts', 'export const session = 1\n')
write('src/application/stores/session.ts', 'export const store = 1\n')
write('src/application/composition.ts', 'export const composition = 1\n')
write('src/application/testing.ts', 'export const testing = 1\n')

const reported: Array<{ rule: string; file: string; source: string }> = [
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
    rule: 'R1-domain-tests-import-only-domain-and-vitest',
    file: 'src/domain/package.test.ts',
    source: "import { useState } from 'react'\nexport const x = useState\n",
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
    rule: 'R3-adapters-no-ui-no-framework',
    file: 'src/adapters/network/react.ts',
    source: "import { useState } from 'react'\nexport const x = useState\n",
  },
  {
    rule: 'R3-adapters-no-ui-no-framework',
    file: 'src/adapters/network/zustand.ts',
    source: "import { create } from 'zustand'\nexport const x = create\n",
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
    rule: 'R5-composition-entry-only-in-app-and-tests',
    file: 'src/features/estimate/composition.ts',
    source:
      "import { composition } from '../../application/composition'\nexport const x = composition\n",
  },
  {
    rule: 'R5-testing-entry-only-in-tests',
    file: 'src/features/estimate/testing.ts',
    source:
      "import { testing } from '../../application/testing'\nexport const x = testing\n",
  },
  {
    rule: 'R5-app-application-only-through-barrel',
    file: 'src/app/stores.ts',
    source:
      "import { store } from '../application/stores/session'\nexport const x = store\n",
  },
  {
    rule: 'no-unresolvable-imports',
    file: 'src/shared/missing.ts',
    source: "import 'a-package-that-is-not-installed'\n",
  },
]

// Exceptions the rules grant on purpose. None of these may be reported.
const allowed: Array<{ file: string; source: string }> = [
  {
    file: 'src/domain/allowed.test.ts',
    source: "import { it } from 'vitest'\nit('x', () => {})\n",
  },
  {
    file: 'src/features/estimate/allowed.test.ts',
    source:
      "import { testing } from '../../application/testing'\nimport { composition } from '../../application/composition'\nexport const x = [testing, composition]\n",
  },
  {
    file: 'src/app/allowed.ts',
    source:
      "import { composition } from '../application/composition'\nimport { session } from '../adapters/network/session'\nexport const x = [composition, session]\n",
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
  const output = (() => {
    for (const { file, source } of [...reported, ...allowed]) write(file, source)
    return violations()
  })()

  it('report every planted violation under the rule that names it', () => {
    const missing = reported.filter(
      ({ rule, file }) =>
        !output.some((line) => line.includes(rule) && line.includes(file)),
    )
    expect(missing).toEqual([])
  })

  it('leave the allowed exceptions alone', () => {
    const wrong = allowed.filter(({ file }) => output.some((line) => line.includes(file)))
    expect(wrong).toEqual([])
  })
})
