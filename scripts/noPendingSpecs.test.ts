// @vitest-environment node
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

// `pnpm specs:no-pending` is a CI gate: if its tag match silently stopped
// matching, a scenario tagged to fail would merge green whatever makes it fail.
// Each case runs the script against a throwaway specs/ tree holding one feature.
const script = join(import.meta.dirname, 'noPendingSpecs.mjs')
let sandbox: string

afterEach(() => rmSync(sandbox, { recursive: true, force: true }))

function runWith(tagLine: string) {
  sandbox = mkdtempSync(join(tmpdir(), 'no-pending-'))
  mkdirSync(join(sandbox, 'specs', 'concept', 'domain'), { recursive: true })
  writeFileSync(
    join(sandbox, 'specs', 'concept', 'domain', 'example.feature'),
    `Feature: Example\n\n  ${tagLine}\n  Scenario: Something\n    Given a step\n`,
  )
  return spawnSync(process.execPath, [script], { cwd: sandbox, encoding: 'utf-8' })
}

describe('specs:no-pending', () => {
  it.each(['@fail', '@fails', '@failing', '@should-fail', '@slow @fail'])(
    'refuses a scenario tagged %s',
    (tags) => {
      const run = runWith(tags)
      expect(run.status).toBe(1)
      expect(run.stderr).toContain('example.feature:3')
    },
  )

  it.each(['@failure', '@slow', '# @fail in a comment'])('accepts %s', (tags) => {
    expect(runWith(tags).status).toBe(0)
  })
})
