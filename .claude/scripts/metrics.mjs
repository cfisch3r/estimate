// Advisory code-metrics hotspots for the architecture-review agent. Never gates anything:
// always exits 0, prints at most MAX_ITEMS one-line items, and prints nothing when nothing
// is notable. A number here is a prompt to inspect cohesion, not a finding.
//
//   pnpm metrics        files touched vs main (committed, uncommitted, untracked)
//   pnpm metrics all    top hotspots across all of src/
//
// Signals: fta-cli per-file score (size + cyclomatic + Halstead) x git churn for ranking,
// then .oxlintrc.metrics.json (per-function limits) for the worst function in each file.
import { execFileSync } from 'node:child_process'

const MAX_ITEMS = 5
const NEEDS_IMPROVEMENT = 60 // fta's own "Needs improvement" band
const isSource = (f) =>
  /^src\/.*\.tsx?$/.test(f) && !/\.test\.tsx?$|testHelpers\.ts$/.test(f)

function run(cmd, args) {
  return execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
}

function lines(out) {
  return out.split('\n').filter(Boolean)
}

function touchedFiles() {
  const base = run('git', ['merge-base', 'main', 'HEAD']).trim()
  return new Set([
    ...lines(run('git', ['diff', '--name-only', base])),
    ...lines(run('git', ['ls-files', '--others', '--exclude-standard'])),
  ])
}

function churnByFile() {
  const out = run('git', [
    'log',
    '--format=format:',
    '--name-only',
    '--since=1 year ago',
    '--',
    'src',
  ])
  const counts = new Map()
  for (const f of lines(out)) counts.set(f, (counts.get(f) ?? 0) + 1)
  return counts
}

// oxlint reports the offending number only in the message text, so parse it out.
function worstFunctions(files) {
  if (files.length === 0) return new Map()
  let out
  try {
    out = run('pnpm', [
      'exec',
      'oxlint',
      '-c',
      '.oxlintrc.metrics.json',
      '--format',
      'json',
      ...files,
    ])
  } catch (err) {
    out = err.stdout ?? '' // oxlint may exit non-zero when it has findings
  }
  const worst = new Map()
  for (const d of JSON.parse(out).diagnostics ?? []) {
    const rule = d.code.replace(/^eslint\((.*)\)$/, '$1')
    const match = /\((\d+)\)|complexity of (\d+)|depth of (\d+)/.exec(d.message)
    const value = Number(match?.slice(1).find(Boolean))
    const name = /[Ff]unction `([^`]+)`/.exec(d.message)?.[1] ?? 'anonymous function'
    const line = d.labels?.[0]?.span?.line ?? 0
    const cur = worst.get(d.filename)
    const beats =
      !cur ||
      (rule === 'complexity' && cur.rule !== 'complexity') ||
      (rule === cur.rule && value > cur.value)
    if (beats) worst.set(d.filename, { rule, value, name, line })
  }
  return worst
}

const all = process.argv[2] === 'all'
const touched = all ? null : touchedFiles()
const churn = churnByFile()

const scored = JSON.parse(run('pnpm', ['exec', 'fta', 'src', '--json']))
  .map((r) => ({ ...r, path: `src/${r.file_name}` }))
  .filter((r) => isSource(r.path) && (all || touched.has(r.path)))
  .map((r) => ({ ...r, churn: churn.get(r.path) ?? 0 }))

const flagged = new Set(
  scored.filter((r) => r.fta_score >= NEEDS_IMPROVEMENT).map((r) => r.path),
)
// Diff mode: any touched file may have an over-limit function, so check them all.
const worst = worstFunctions(all ? [...flagged] : scored.map((r) => r.path))

const priority = (r) => r.fta_score * Math.log2(r.churn + 1)
const items = scored
  .filter((r) => flagged.has(r.path) || (!all && worst.has(r.path)))
  .sort((a, b) => priority(b) - priority(a))
  .slice(0, MAX_ITEMS)

for (const r of items) {
  const w = worst.get(r.path)
  const fn = w ? `; worst: ${w.name} ${w.rule}=${w.value} (line ${w.line})` : ''
  console.log(
    `${r.path} — fta ${r.fta_score.toFixed(1)}, ${r.line_count} lines, cyclo ${r.cyclo}, churn ${r.churn}/12mo${fn}`,
  )
}
