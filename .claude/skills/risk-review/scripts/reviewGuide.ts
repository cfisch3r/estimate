import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { baseRef, repoRoot, showAt } from './changedDiff.ts'
import { parseCatalogue, RISK_LEVELS, type Floor, type RiskLevel } from './reviewFloor.ts'
import type { Section } from './reviewSignals.ts'

// The Review guide, built on request while reviewing a branch. A script writes it, not the
// model: the script takes the higher of the floor and the agent's risk, drops hot spots
// that are not part of the change, adds the facts from the signals, and renders one
// self-contained HTML page that is published as an artifact.
//
//   pnpm review:guide --floor floor.json --signals signals.json --agent agent.json \
//     [--covers <commit>] [--title <page title>]
//
// Prints the HTML page. The inputs are the outputs of `pnpm review:floor`,
// `pnpm review:signals` and the `risk-review:reviewer` agent.

export interface HotSpot {
  file: string
  line: number
  /** What the change at the spot is, in a few words. */
  title: string
  /** What the change is and what makes it a hot spot. */
  body: string
  rule: string
  /** What the signals say about the spot; the script writes these, never the agent. */
  facts: string[]
}

export interface SkimItem {
  file: string
  why: string
}

export interface EvidenceItem {
  /**
   * `reviewer` is what the agent could not verify; the others are the script's facts.
   * `warning` is the script saying the guide lacks content it was given (dropped hot spots).
   * `not-checked`, `reviewer` and `warning` are shown as "Not verified", the rest is folded.
   */
  kind: 'checked' | 'not-checked' | 'note' | 'reviewer' | 'warning'
  text: string
}

export interface GuideData {
  covers: string
  /** `https://github.com/<owner>/<repo>`, to link a hot spot to the file at `covers`. */
  repoUrl?: string
  risk: RiskLevel
  floor: RiskLevel
  categories: string[]
  hotSpots: HotSpot[]
  skimOnly: SkimItem[]
  evidence: EvidenceItem[]
}

export interface AgentAnswer {
  risk?: unknown
  categories?: unknown
  hotSpots?: unknown
  skimOnly?: unknown
  notVerified?: unknown
}

export interface GuideInput {
  covers: string
  floor: Floor
  signals: Signals
  agent: AgentAnswer
  /** The category names of the catalogue, to drop names the agent made up. */
  catalogueNames: string[]
  repoUrl?: string
}

/** The parts of the signals output the guide uses; every section may be missing. */
export interface Signals {
  history?: Section<{ since?: string; files?: Array<{ path: string; fixes: number }> }>
  metrics?: Section<{ items: string[] }>
  coverage?: Section<{ checkedFiles: number; uncovered: string[]; notInReport: string[] }>
  dependencies?: Section<{
    changed: unknown[]
    lockfileEntries: string[]
    advisories: Section<{
      items: Array<{ module: string; version: string; severity: string; id: string }>
    }>
  }>
}

const MAX_HOT_SPOTS = 8
const MAX_LISTED = 10
/** Fix commits that make a file worth a note on its hot spots. */
const MIN_FIXES = 2

const higher = (a: RiskLevel, b: RiskLevel) =>
  RISK_LEVELS.indexOf(a) >= RISK_LEVELS.indexOf(b) ? a : b

// Agent text is put on one line; the renderer escapes it for HTML.
const oneLine = (text: string) => text.replace(/\s+/g, ' ').trim()
const isText = (value: unknown): value is string =>
  typeof value === 'string' && oneLine(value) !== ''

// --- the agent's answer ---------------------------------------------------------------

/** Reads the agent's reply: one fenced `json` block, or bare JSON. */
export function parseAgentAnswer(reply: string): AgentAnswer {
  const fenced = /```json\s*\n([\s\S]*?)```/.exec(reply)
  const text = fenced ? (fenced[1] ?? '') : reply
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch (error) {
    throw new Error('The agent answer is not valid JSON', { cause: error })
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('The agent answer is not a JSON object')
  }
  return value as AgentAnswer
}

// --- evidence from the signals --------------------------------------------------------

function listed(items: string[]): string {
  const shown = items.slice(0, MAX_LISTED).join(', ')
  return items.length > MAX_LISTED
    ? `${shown} and ${items.length - MAX_LISTED} more`
    : shown
}

/** What the scripts measured, in the words the guide shows. Never invents a result. */
export function evidenceFromSignals(signals: Signals): EvidenceItem[] {
  const out: EvidenceItem[] = []
  const { coverage, dependencies, history, metrics } = signals

  if (!coverage) {
    out.push({ kind: 'not-checked', text: 'Changed-line coverage: no signal given' })
  } else if (coverage.status === 'not available') {
    out.push({
      kind: 'not-checked',
      text: `Changed-line coverage: ${oneLine(coverage.reason)}`,
    })
  } else if (coverage.checkedFiles === 0) {
    out.push({ kind: 'note', text: 'Changed-line coverage: no source file changed' })
  } else {
    out.push(
      coverage.uncovered.length === 0
        ? {
            kind: 'checked',
            text: `Changed-line coverage: every changed line ran in ${coverage.checkedFiles} source file(s)`,
          }
        : {
            kind: 'checked',
            text: `Changed-line coverage: ${coverage.uncovered.length} changed line(s) never ran: ${listed(coverage.uncovered)}`,
          },
    )
    if (coverage.notInReport.length > 0) {
      out.push({
        kind: 'not-checked',
        text: `Changed-line coverage: no data for ${listed(coverage.notInReport)}`,
      })
    }
  }

  if (!dependencies) {
    out.push({ kind: 'not-checked', text: 'Dependencies: no signal given' })
  } else if (dependencies.status === 'not available') {
    out.push({
      kind: 'not-checked',
      text: `Dependencies: ${oneLine(dependencies.reason)}`,
    })
  } else if (
    dependencies.changed.length === 0 &&
    dependencies.lockfileEntries.length === 0
  ) {
    out.push({ kind: 'note', text: 'Dependencies: none changed' })
  } else if (dependencies.advisories.status === 'not available') {
    out.push({
      kind: 'not-checked',
      text: `Dependency audit: ${oneLine(dependencies.advisories.reason)}`,
    })
  } else if (dependencies.advisories.items.length === 0) {
    out.push({
      kind: 'checked',
      text: 'Dependency audit: no advisory for the added versions',
    })
  } else {
    const hits = dependencies.advisories.items.map(
      (a) => `${a.module}@${a.version} (${a.severity}, ${a.id})`,
    )
    out.push({ kind: 'checked', text: `Dependency audit: ${listed(hits)}` })
  }

  if (history?.status === 'not available') {
    out.push({ kind: 'not-checked', text: `File history: ${oneLine(history.reason)}` })
  }
  if (metrics?.status === 'not available') {
    out.push({
      kind: 'not-checked',
      text: `Metrics hotspots: ${oneLine(metrics.reason)}`,
    })
  } else if (metrics?.status === 'ok' && metrics.items.length > 0) {
    out.push({
      kind: 'note',
      text: `Metrics hotspots: ${listed(metrics.items.map(oneLine))}`,
    })
  }
  return out
}

/** What the signals say about one changed line, in the words the guide shows. */
function factsFor(file: string, line: number, signals: Signals): string[] {
  const facts: string[] = []
  const { coverage, history } = signals
  if (coverage?.status === 'ok' && coverage.uncovered.includes(`${file}:${line}`)) {
    facts.push('No test runs this line')
  }
  if (history?.status === 'ok') {
    const fixes = history.files?.find((f) => f.path === file)?.fixes ?? 0
    if (fixes >= MIN_FIXES) {
      facts.push(
        `${fixes} fix commits in the last ${oneLine(history.since ?? '6 months')}`,
      )
    }
  }
  return facts
}

// --- building the guide ---------------------------------------------------------------

/** The guide data: the script's facts, with the agent's judgment kept inside the rules. */
export function buildGuide(input: GuideInput): GuideData {
  const { floor, agent } = input
  const evidence = evidenceFromSignals(input.signals)
  const note = (text: string) => evidence.push({ kind: 'note', text })
  const warn = (text: string) => evidence.push({ kind: 'warning', text })

  let agentRisk: RiskLevel = floor.floor
  if (RISK_LEVELS.includes(agent.risk as RiskLevel)) {
    agentRisk = agent.risk as RiskLevel
  } else {
    note('The reviewer gave no valid risk level, so the floor stands')
  }
  const risk = higher(floor.floor, agentRisk)
  if (RISK_LEVELS.indexOf(agentRisk) < RISK_LEVELS.indexOf(floor.floor)) {
    note(
      `The reviewer rated the change ${agentRisk}, below the floor ${floor.floor}; the floor stands`,
    )
  }

  const known = new Set(input.catalogueNames)
  const named = Array.isArray(agent.categories)
    ? agent.categories.filter((c): c is string => typeof c === 'string')
    : []
  const unknown = named.filter((c) => !known.has(c))
  if (unknown.length > 0)
    note(`Dropped categories not in the catalogue: ${unknown.join(', ')}`)
  const categories = [
    ...new Set([
      ...floor.categories.map((c) => c.name),
      ...named.filter((c) => known.has(c)),
    ]),
  ]

  const changedLines = floor.changedLines
  const rawSpots = Array.isArray(agent.hotSpots) ? (agent.hotSpots as unknown[]) : []
  const spots: HotSpot[] = []
  for (const raw of rawSpots) {
    const spot = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<
      string,
      unknown
    >
    const { file, line, title, body, rule } = spot
    if (
      isText(file) &&
      typeof line === 'number' &&
      Object.hasOwn(changedLines, file) &&
      changedLines[file]?.includes(line) &&
      isText(title) &&
      isText(body)
    ) {
      spots.push({
        file,
        line,
        title: oneLine(title),
        body: oneLine(body),
        rule: isText(rule) ? oneLine(rule) : 'general',
        facts: factsFor(file, line, input.signals),
      })
    }
  }
  const dropped = rawSpots.length - spots.length
  if (dropped > 0)
    warn(
      `Dropped ${dropped} hot spot(s) that are not a changed line of the change or have no title or body`,
    )
  if (spots.length > MAX_HOT_SPOTS) {
    warn(`Showing ${MAX_HOT_SPOTS} of ${spots.length} hot spots`)
  }

  const skim: SkimItem[] = []
  for (const raw of Array.isArray(agent.skimOnly) ? (agent.skimOnly as unknown[]) : []) {
    const item = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<
      string,
      unknown
    >
    if (isText(item.file) && isText(item.why)) {
      skim.push({ file: item.file, why: oneLine(item.why) })
    }
  }

  const gaps = Array.isArray(agent.notVerified) ? (agent.notVerified as unknown[]) : []
  for (const text of gaps) {
    if (isText(text)) evidence.push({ kind: 'reviewer', text: oneLine(text) })
  }

  const data: GuideData = {
    covers: input.covers,
    ...(input.repoUrl ? { repoUrl: input.repoUrl } : {}),
    risk,
    floor: floor.floor,
    categories,
    hotSpots: spots.slice(0, MAX_HOT_SPOTS),
    skimOnly: skim,
    evidence,
  }
  return data
}

// --- rendering ------------------------------------------------------------------------

/** Escapes text for HTML, in content and in a quoted attribute. */
const esc = (text: string) =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
const code = (text: string) => `<code>${esc(text)}</code>`
const evidenceLine = (e: EvidenceItem) =>
  `${{ checked: 'Checked', 'not-checked': 'Not checked', note: 'Note', reviewer: 'Reviewer note', warning: 'Warning' }[e.kind]}: ${e.text}`

const FULL_SHA = /^[0-9a-f]{40}$/

/** Percent-encodes a path for a link, parentheses included. */
const encodePath = (path: string) =>
  path
    .split('/')
    .map((part) =>
      encodeURIComponent(part).replace(
        /[()]/g,
        (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
      ),
    )
    .join('/')

const DARK_TOKENS = `--bg:#0d1117;--fg:#e6edf3;--muted:#8d96a0;--line:#30363d;--card:#161b22;--link:#58a6ff;--low:#3fb950;--medium:#d29922;--high:#f0883e;--critical:#ff7b72;color-scheme:dark;`
const STYLE = `
:root{--bg:#ffffff;--fg:#1f2328;--muted:#59636e;--line:#d1d9e0;--card:#f6f8fa;--link:#0969da;--low:#1a7f37;--medium:#9a6700;--high:#bc4c00;--critical:#cf222e}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){${DARK_TOKENS}}}
:root[data-theme="dark"]{${DARK_TOKENS}}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,sans-serif}
main{max-width:760px;margin:0 auto;padding:24px 16px 48px}
h1{font-size:1.6rem;margin:0 0 4px}
h2{font-size:1.1rem;margin:32px 0 12px;padding-bottom:6px;border-bottom:1px solid var(--line)}
code{font:0.9em ui-monospace,monospace;overflow-wrap:anywhere}
a{color:var(--link)}
.muted{color:var(--muted)}
.badge{display:inline-block;padding:2px 10px;border-radius:12px;font-weight:600;border:1px solid currentColor}
.risk-low{color:var(--low)}.risk-medium{color:var(--medium)}.risk-high{color:var(--high)}.risk-critical{color:var(--critical)}
.spots{list-style:none;margin:0;padding:0;display:grid;gap:12px}
.spot{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:12px 16px}
.spot p{margin:6px 0 0}
.spot .title{font-weight:600;margin:0}
.facts{color:var(--muted);font-size:0.9rem}
ul.plain{margin:0;padding-left:20px}
details{margin-top:16px}
summary{cursor:pointer;color:var(--muted)}
`

function htmlSpot(s: HotSpot, data: GuideData): string {
  const place = code(`${s.file}:${s.line}`)
  const reference =
    data.repoUrl && FULL_SHA.test(data.covers)
      ? `<a href="${esc(`${data.repoUrl}/blob/${data.covers}/${encodePath(s.file)}#L${s.line}`)}">${place}</a>`
      : place
  return [
    '<li class="spot">',
    `<p class="title">${esc(s.title)}</p>`,
    `<p>${esc(s.body)}</p>`,
    `<p>${reference} · ${esc(s.rule)}</p>`,
    ...(s.facts.length > 0
      ? [`<p class="facts">Facts: ${s.facts.map(esc).join(' · ')}</p>`]
      : []),
    '</li>',
  ].join('\n')
}

/** The guide as one self-contained HTML page: title, style and content, for an artifact. */
export function renderHtml(data: GuideData, title = 'Review guide'): string {
  const raised = data.risk !== data.floor ? `, raised from the floor ${data.floor}` : ''
  const names =
    data.categories.length > 0
      ? data.categories.map(code).join(', ')
      : 'no category matched'
  const gaps = data.evidence.filter(
    (e) => e.kind === 'not-checked' || e.kind === 'reviewer' || e.kind === 'warning',
  )
  const checked = data.evidence.filter((e) => e.kind === 'checked' || e.kind === 'note')
  const list = (items: string[], empty: string) =>
    items.length === 0
      ? `<p class="muted">${empty}</p>`
      : `<ul class="plain">\n${items.map((i) => `<li>${i}</li>`).join('\n')}\n</ul>`

  return [
    `<title>${esc(title)}</title>`,
    `<style>${STYLE}</style>`,
    '<main>',
    `<h1>${esc(title)}</h1>`,
    `<p class="muted">Covers ${code(data.covers.slice(0, 7))}</p>`,
    '<h2>Risk</h2>',
    `<p><span class="badge risk-${data.risk}">${data.risk}</span>${esc(raised)} — ${names}</p>`,
    '<h2>Hot spots</h2>',
    data.hotSpots.length === 0
      ? '<p class="muted">None.</p>'
      : `<ol class="spots">\n${data.hotSpots.map((s) => htmlSpot(s, data)).join('\n')}\n</ol>`,
    '<h2>Skim only</h2>',
    list(
      data.skimOnly.map((s) => `${code(s.file)} — ${esc(s.why)}`),
      'None.',
    ),
    '<h2>Not verified</h2>',
    list(
      gaps.map((e) => esc(e.text)),
      'Nothing flagged.',
    ),
    ...(checked.length > 0
      ? [
          '<details>',
          '<summary>Checked by the scripts</summary>',
          list(
            checked.map((e) => esc(evidenceLine(e))),
            '',
          ),
          '</details>',
        ]
      : []),
    '</main>',
  ].join('\n')
}

/** The GitHub address of a remote (https or ssh form), or undefined for any other host. */
export function githubUrl(remote: string): string | undefined {
  const match =
    /^(?:https:\/\/(?:[^@/]+@)?github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/.exec(
      remote.trim(),
    )
  return match ? `https://github.com/${match[1]}/${match[2]}` : undefined
}

/** The GitHub address of the `origin` remote, or undefined when there is none or it is elsewhere. */
export function originUrl(cwd: string): string | undefined {
  try {
    return githubUrl(
      execFileSync('git', ['remote', 'get-url', 'origin'], {
        cwd,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }),
    )
  } catch {
    // No origin remote: the references stay plain text.
    return undefined
  }
}

// --- run ------------------------------------------------------------------------------

function option(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`)
  const value = process.argv[index + 1]
  return index < 0 || value === undefined || value.startsWith('--') ? undefined : value
}

function required(name: string): string {
  const path = option(name)
  if (!path) throw new Error(`Missing --${name} <file>`)
  return path
}

function readJson(name: string): unknown {
  return JSON.parse(readFileSync(required(name), 'utf8'))
}

function main() {
  const cwd = repoRoot()
  const base = baseRef(cwd)
  const floor = readJson('floor') as Floor
  const signals = readJson('signals') as Signals
  const agent = parseAgentAnswer(readFileSync(required('agent'), 'utf8'))
  const covers =
    option('covers') ??
    execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim()
  const catalogueNames = parseCatalogue(showAt(base, 'docs/review-risk.md', cwd)).map(
    (c) => c.name,
  )

  const repoUrl = originUrl(cwd)
  const data = buildGuide({ covers, floor, signals, agent, catalogueNames, repoUrl })
  process.stdout.write(renderHtml(data, option('title')) + '\n')
}

if (process.argv[1] === import.meta.filename) {
  try {
    main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
