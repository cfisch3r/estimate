// Fails when a Gherkin spec still carries the `@fail` tag (ADR-010). `@fail`
// marks a scenario written before its implementation: the runners count it as
// passing while it fails, whatever the reason. That is meant for a branch in
// progress only, so CI refuses it, and the change that implements a spec has
// to remove the tag before it can merge. Not part of the Stop hook, which has
// to stay green while a spec is pending.
//
//   pnpm specs:no-pending
import { globSync, readFileSync } from 'node:fs'

// `@fail` is the tag ADR-010 uses. quickpickle merges its own defaults into
// `failTags`, so `@fails`, `@failing` and `@should-fail` invert a result too.
const FAIL_TAG = /(^|\s)@(fail|fails|failing|should-fail)(?=\s|$)/

const pending = globSync('specs/**/*.feature').flatMap((path) =>
  readFileSync(path, 'utf-8')
    .split('\n')
    .map((line, index) => ({ path, line: index + 1, text: line.trim() }))
    .filter(({ text }) => text.startsWith('@') && FAIL_TAG.test(text)),
)

if (pending.length > 0) {
  for (const { path, line, text } of pending) console.error(`${path}:${line}  ${text}`)
  console.error(
    `\n${pending.length} spec tag(s) still marked to fail. Implement the scenario and remove the tag (ADR-010).`,
  )
  process.exit(1)
}
console.log('No spec is marked to fail.')
