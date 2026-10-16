import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { repoRoot } from './changedDiff.ts'
import { RISK_LEVELS, readFloor, type Floor } from './reviewFloor.ts'
import { parseGuide, renderVisible, type GuideData } from './reviewGuide.ts'

// Checks the Review guide in a pull request body. It covers what a reader cannot easily
// see: a guide below the floor or a guide edited by hand. A reader still
// notices a missing guide first, so this is a safety net, not a gate. No model, no coverage
// run, no network call, except `--pr`, which reads the body with `gh`.
//
//   pnpm review:check-guide --body body.md
//   pnpm review:check-guide --pr <number>
//
// Prints the problems, if any, and exits 1 when the guide fails the check.

export interface Check {
  status: 'ok' | 'skipped' | 'failed'
  /** Why the guide was skipped, when it was. */
  reason?: string
  problems: string[]
}

export interface CheckInput {
  body: string
  /** The floor of the whole branch (`pnpm review:floor`). */
  floor: Floor
}

const SKIP = /^Review guide: skipped \((.*)\)[ \t]*$/m
const PARTS = ['### Risk', '### Hot spots', '### Skim only', '### Not verified']

const level = (risk: string) => RISK_LEVELS.indexOf(risk as (typeof RISK_LEVELS)[number])

export function checkGuide(input: CheckInput): Check {
  const body = input.body.replace(/\r\n/g, '\n')
  const parsed = parseGuide(body)

  if (!parsed) {
    if (body.includes('<!-- review-guide:start -->')) {
      return failed(
        'The guide is there, but its data is missing or damaged. Run `pnpm review:guide` again.',
      )
    }
    // A deliberate skip is only valid when there is no guide to check.
    const skip = SKIP.exec(body)
    if (skip) {
      const reason = (skip[1] ?? '').trim()
      return reason
        ? { status: 'skipped', reason, problems: [] }
        : failed('The skip line has no reason: write `Review guide: skipped (reason)`.')
    }
    return failed('There is no Review guide in the body.')
  }

  const { data, visible } = parsed
  const problems: string[] = []

  // Structure: the marker and all four parts.
  if (!/^Covers: `[^`]+`$/m.test(visible))
    problems.push('The `Covers:` marker is missing.')
  for (const part of PARTS) {
    if (!visible.includes(`\n${part}\n`))
      problems.push(`The part "${part.slice(4)}" is missing.`)
  }

  // Hand edits: the visible text must be what the data renders to.
  if (problems.length === 0 && !rendersTo(data, visible)) {
    problems.push(
      'The guide text differs from its data, so it was edited by hand or written by an older version of the script. Run `pnpm review:guide` again.',
    )
  }

  // Floor: the stated risk is at least the floor, and every matched category is named.
  if (level(data.risk) < level(input.floor.floor)) {
    problems.push(
      `The guide says ${data.risk}, below the floor ${input.floor.floor}. Later commits may have raised the floor; ask for an update of the guide.`,
    )
  }
  const missing = input.floor.categories
    .map((c) => c.name)
    .filter((n) => !data.categories.includes(n))
  if (missing.length > 0) {
    problems.push(`The guide leaves out matched categories: ${missing.join(', ')}.`)
  }

  return problems.length > 0 ? { status: 'failed', problems } : { status: 'ok', problems }
}

/** Whether the data renders to the visible text; data that cannot be rendered does not. */
function rendersTo(data: GuideData, visible: string): boolean {
  try {
    return renderVisible(data) === visible
  } catch {
    return false
  }
}

function failed(problem: string): Check {
  return { status: 'failed', problems: [problem] }
}

// --- run ------------------------------------------------------------------------------

function option(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`)
  return index < 0 ? undefined : process.argv[index + 1]
}

function readBody(cwd: string): string {
  const file = option('body')
  if (file) return readFileSync(file, 'utf8')
  const pr = option('pr')
  if (pr) {
    if (!/^\d+$/.test(pr)) throw new Error(`Expected a pull request number, got "${pr}"`)
    return execFileSync('gh', ['pr', 'view', pr, '--json', 'body', '--jq', '.body'], {
      cwd,
      encoding: 'utf8',
    })
  }
  throw new Error('Give --body <file> or --pr <number>')
}

function main() {
  const cwd = repoRoot()
  const result = checkGuide({
    body: readBody(cwd),
    floor: readFloor({ cwd }),
  })
  if (result.status === 'skipped') console.log(`Review guide skipped: ${result.reason}`)
  else if (result.status === 'ok') console.log('Review guide: ok')
  else {
    for (const problem of result.problems) console.error(`- ${problem}`)
    process.exitCode = 1
  }
}

if (process.argv[1] === import.meta.filename) {
  try {
    main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
