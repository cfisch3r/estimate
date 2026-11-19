// @vitest-environment node
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'

// The spec rules in `.dependency-cruiser.specs.cjs` can stay green without
// checking anything: a path regex that never matches lets every import through.
// Each case below plants one import in a throwaway project and checks that the
// named rule reports it; the "allowed" cases check the deliberate exceptions the
// other way round. Same pattern as `layerRules.test.ts`.
const root = join(import.meta.dirname, '..')
const sandbox = mkdtempSync(join(root, '.spec-rules-canary-'))

afterAll(() => rmSync(sandbox, { recursive: true, force: true }))

writeFileSync(
  join(sandbox, 'tsconfig.playwright.json'),
  JSON.stringify({ compilerOptions: { module: 'esnext', moduleResolution: 'bundler' } }),
)

function write(file: string, source: string) {
  const path = join(sandbox, file)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, source)
}

// Targets the planted imports point at.
write('src/adapters/file/fileDownload.ts', 'export const download = 1\n')
write('src/application/useCases/save.ts', 'export const save = 1\n')
write('src/application/ports/outbound/fileDownload.ts', 'export type Port = 1\n')
write('src/application/ports/fileDownloadContext.ts', 'export const context = 1\n')
write('src/application/stores/session.ts', 'export type Store = 1\n')
write('src/domain/value.ts', 'export const value = 1\n')

const reported: Array<{ rule: string; file: string; source: string }> = [
  {
    rule: 'specs-integration-harness-imports-adapters-ports-domain',
    file: 'specs/shared/integration/harness/useCase.ts',
    source:
      "import { save } from '../../../../src/application/useCases/save'\nexport const x = save\n",
  },
  {
    rule: 'specs-integration-harness-imports-adapters-ports-domain',
    file: 'specs/shared/integration/harness/context.ts',
    source:
      "import { context } from '../../../../src/application/ports/fileDownloadContext'\nexport const x = context\n",
  },
  {
    rule: 'specs-integration-only-port-and-domain-types',
    file: 'specs/demo/integration/storeType.ts',
    source:
      "import type { Store } from '../../../src/application/stores/session'\nexport type X = Store\n",
  },
  {
    rule: 'specs-integration-type-only-src',
    file: 'specs/demo/integration/steps.ts',
    source:
      "import { download } from '../../../src/adapters/file/fileDownload'\nexport const x = download\n",
  },
  {
    rule: 'specs-integration-type-only-src',
    file: 'specs/shared/integration/driver.ts',
    source: "import { value } from '../../../src/domain/value'\nexport const x = value\n",
  },
]

// Exceptions the rules grant on purpose. None of these may be reported.
const allowed: Array<{ file: string; source: string }> = [
  {
    file: 'specs/demo/integration/typeOnly.ts',
    source:
      "import type { Port } from '../../../src/application/ports/outbound/fileDownload'\nexport type X = Port\n",
  },
  {
    file: 'specs/shared/integration/harness/port.ts',
    source:
      "import type { Port } from '../../../../src/application/ports/outbound/fileDownload'\nexport type X = Port\n",
  },
  {
    file: 'specs/shared/integration/harness/harness.ts',
    source:
      "import { download } from '../../../../src/adapters/file/fileDownload'\nimport { value } from '../../../../src/domain/value'\nexport const x = [download, value]\n",
  },
]

function violations(): string[] {
  try {
    execFileSync(
      join(root, 'node_modules/.bin/depcruise'),
      [
        'specs',
        '--config',
        join(root, '.dependency-cruiser.specs.cjs'),
        '--output-type',
        'err',
      ],
      { cwd: sandbox, encoding: 'utf-8', stdio: 'pipe' },
    )
    return []
  } catch (error) {
    return String((error as { stdout?: string }).stdout ?? error).split('\n')
  }
}

describe('spec rules', () => {
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
