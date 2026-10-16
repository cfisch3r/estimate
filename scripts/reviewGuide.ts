import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { baseRef, repoRoot, showAt } from './changedDiff.ts'
import { parseCatalogue, RISK_LEVELS, type Floor, type RiskLevel } from './reviewFloor.ts'
import type { Section } from './reviewSignals.ts'

// The Review guide at the top of a pull request body. A script writes it, not the model:
// the script takes the higher of the floor and the agent's risk, drops hot spots that are
// not part of the change, and renders the same data twice, as Markdown for the reader and
// as JSON in a hidden comment for the check script.
//
//   pnpm review:guide --floor floor.json --signals signals.json --agent agent.json \
//     [--body body.md] [--covers <commit>]
//
// Prints the guide block, or the whole body with the guide block put at its top when
// --body is given. The inputs are the outputs of `pnpm review:floor`,
// `pnpm review:signals` and the `risk-review` agent.

export interface HotSpot {
  file: string
  line: number
  reason: string
  rule: string
}

export interface SkimItem {
  file: string
  why: string
}

export interface EvidenceItem {
  /** `reviewer` is the agent's own wording; the others are the script's facts. */
  kind: 'checked' | 'not-checked' | 'note' | 'reviewer'
  text: string
}

export interface GuideData {
  version: 1
  covers: string
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
  evidenceNotes?: unknown
}

export interface GuideInput {
  covers: string
  floor: Floor
  signals: Signals
  agent: AgentAnswer
  /** The category names of the catalogue, to drop names the agent made up. */
  catalogueNames: string[]
}

/** The parts of the signals output the guide uses; every section may be missing. */
export interface Signals {
  history?: Section<Record<string, unknown>>
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
const START = '<!-- review-guide:start -->'
const END = '<!-- review-guide:end -->'
const DATA_PREFIX = '<!-- review-guide-data: '

const higher = (a: RiskLevel, b: RiskLevel) =>
  RISK_LEVELS.indexOf(a) >= RISK_LEVELS.indexOf(b) ? a : b

// Agent text goes into the visible Markdown, so it is put on one line and every `<` and `>`
// is escaped. That way it cannot open or close an HTML comment (`-->` or `--!>`) or add
// markup, which would cut the guide block short.
const oneLine = (text: string) =>
  text.replace(/\s+/g, ' ').trim().replace(/</g, '&lt;').replace(/>/g, '&gt;')
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

// --- building the guide ---------------------------------------------------------------

/** The guide data: the script's facts, with the agent's judgment kept inside the rules. */
export function buildGuide(input: GuideInput): GuideData {
  const { floor, agent } = input
  const evidence = evidenceFromSignals(input.signals)
  const note = (text: string) => evidence.push({ kind: 'note', text })

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
    const { file, line, reason, rule } = spot
    if (
      isText(file) &&
      typeof line === 'number' &&
      Object.hasOwn(changedLines, file) &&
      changedLines[file]?.includes(line) &&
      isText(reason)
    ) {
      spots.push({
        file,
        line,
        reason: oneLine(reason),
        rule: isText(rule) ? oneLine(rule) : 'general',
      })
    }
  }
  const dropped = rawSpots.length - spots.length
  if (dropped > 0)
    note(`Dropped ${dropped} hot spot(s) that are not a changed line of the change`)
  if (spots.length > MAX_HOT_SPOTS) {
    note(`Showing ${MAX_HOT_SPOTS} of ${spots.length} hot spots`)
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

  const agentNotes = Array.isArray(agent.evidenceNotes)
    ? (agent.evidenceNotes as unknown[])
    : []
  for (const text of agentNotes) {
    if (isText(text)) evidence.push({ kind: 'reviewer', text: oneLine(text) })
  }

  const data: GuideData = {
    version: 1,
    covers: input.covers,
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

const code = (text: string) => `\`${text.replace(/`/g, "'")}\``
const spotLine = (s: HotSpot) =>
  `${code(`${s.file}:${s.line}`)} — ${s.reason} (${s.rule})`
const evidenceLine = (e: EvidenceItem) =>
  `${{ checked: 'Checked', 'not-checked': 'Not checked', note: 'Note', reviewer: 'Reviewer note' }[e.kind]}: ${e.text}`

/** The data as JSON that is safe inside an HTML comment. */
function dataComment(data: GuideData): string {
  const json = JSON.stringify(data).replace(/</g, '\\u003c').replace(/>/g, '\\u003e')
  return `${DATA_PREFIX}${json} -->`
}

/** The visible Markdown of the guide, without the data comment. */
export function renderVisible(data: GuideData): string {
  const lines = [
    '## Review guide',
    '',
    `Covers: ${code(data.covers.slice(0, 7))}`,
    '',
    '### Risk',
    '',
  ]
  const raised = data.risk !== data.floor ? `, raised from the floor ${data.floor}` : ''
  const names =
    data.categories.length > 0
      ? data.categories.map(code).join(', ')
      : 'no category matched'
  lines.push(`**${data.risk}**${raised} — ${names}`, '', '### Hot spots', '')
  if (data.hotSpots.length === 0) lines.push('None.')
  data.hotSpots.forEach((s, i) => lines.push(`${i + 1}. ${spotLine(s)}`))
  lines.push('', '### Skim only', '')
  if (data.skimOnly.length === 0) lines.push('None.')
  for (const s of data.skimOnly) lines.push(`- ${code(s.file)} — ${s.why}`)
  lines.push('', '### Evidence', '')
  if (data.evidence.length === 0) lines.push('None.')
  for (const e of data.evidence) lines.push(`- ${evidenceLine(e)}`)
  return lines.join('\n')
}

/** The whole guide block: visible Markdown, hidden data, and the markers around both. */
export function renderGuide(data: GuideData): string {
  return [START, renderVisible(data), '', dataComment(data), END].join('\n')
}

// --- reading and replacing the block in a body ----------------------------------------

const BLOCK = new RegExp(`${START}[\\s\\S]*?${END}`)

export interface ParsedGuide {
  data: GuideData
  /** The block's visible Markdown, without the markers and the data comment. */
  visible: string
}

const isStrings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((v) => typeof v === 'string')

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isSpot = (v: unknown) =>
  isObject(v) &&
  typeof v.file === 'string' &&
  typeof v.line === 'number' &&
  typeof v.reason === 'string' &&
  typeof v.rule === 'string'

const isEvidence = (v: unknown) =>
  isObject(v) &&
  ['checked', 'not-checked', 'note', 'reviewer'].includes(v.kind as string) &&
  typeof v.text === 'string'

const isSkim = (v: unknown) =>
  isObject(v) && typeof v.file === 'string' && typeof v.why === 'string'

const all = (value: unknown, test: (v: unknown) => boolean) =>
  Array.isArray(value) && value.every(test)

/** Whether parsed JSON has the shape the check relies on. */
function isGuideData(value: unknown): value is GuideData {
  if (!isObject(value)) return false
  return (
    value.version === 1 &&
    typeof value.covers === 'string' &&
    RISK_LEVELS.includes(value.risk as RiskLevel) &&
    RISK_LEVELS.includes(value.floor as RiskLevel) &&
    isStrings(value.categories) &&
    all(value.hotSpots, isSpot) &&
    all(value.skimOnly, isSkim) &&
    all(value.evidence, isEvidence)
  )
}

/** Reads the guide in a body, or undefined when there is none or its data is unreadable. */
export function parseGuide(rawBody: string): ParsedGuide | undefined {
  // GitHub returns a body edited in the browser with Windows line endings.
  const body = rawBody.replace(/\r\n/g, '\n')
  const block = BLOCK.exec(body)?.[0]
  if (!block) return undefined
  const start = block.indexOf(DATA_PREFIX)
  const end = block.lastIndexOf(' -->\n' + END)
  if (start < 0 || end < start) return undefined
  try {
    const data: unknown = JSON.parse(block.slice(start + DATA_PREFIX.length, end))
    if (!isGuideData(data)) return undefined
    const visible = block.slice(START.length + 1, start).trimEnd()
    return { data, visible }
  } catch {
    return undefined
  }
}

/** Puts the guide at the top of the body, or replaces the one that is there. */
export function replaceGuide(body: string, guide: string): string {
  if (BLOCK.test(body)) return body.replace(BLOCK, () => guide)
  const rest = body.trim()
  return rest === '' ? `${guide}\n` : `${guide}\n\n${rest}\n`
}

// --- run ------------------------------------------------------------------------------

function option(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`)
  return index < 0 ? undefined : process.argv[index + 1]
}

function readJson(name: string): unknown {
  const path = option(name)
  if (!path) throw new Error(`Missing --${name} <file>`)
  return JSON.parse(readFileSync(path, 'utf8'))
}

function main() {
  const cwd = repoRoot()
  const base = baseRef(cwd)
  const floor = readJson('floor') as Floor
  const signals = readJson('signals') as Signals
  const agent = parseAgentAnswer(readFileSync(option('agent') ?? '', 'utf8'))
  const bodyPath = option('body')
  const body = bodyPath ? readFileSync(bodyPath, 'utf8') : undefined
  const covers =
    option('covers') ??
    execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim()
  const catalogueNames = parseCatalogue(showAt(base, 'docs/review-risk.md', cwd)).map(
    (c) => c.name,
  )

  const guide = renderGuide(buildGuide({ covers, floor, signals, agent, catalogueNames }))
  process.stdout.write((body === undefined ? guide : replaceGuide(body, guide)) + '\n')
}

if (process.argv[1] === import.meta.filename) {
  try {
    main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
