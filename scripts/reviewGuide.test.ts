// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { Floor } from './reviewFloor.ts'
import {
  buildGuide,
  evidenceFromSignals,
  parseAgentAnswer,
  parseGuide,
  renderGuide,
  renderVisible,
  replaceGuide,
  type AgentAnswer,
  type GuideData,
  type GuideInput,
  type Signals,
} from './reviewGuide.ts'

// The guide script holds the rules that the agent's prompt only asks for: the risk is the
// higher of the floor and the agent's, hot spots must be lines of the change, and what the
// reader sees is rendered from the same data the check script reads back.
const NAMES = ['domain-math', 'wire-contract', 'guardrail-weakened', 'mechanical']

const floor = (risk: Floor['floor'], categories: string[], files: string[]): Floor => ({
  floor: risk,
  categories: categories.map((name) => ({ name, minRisk: risk, files, diffChecks: [] })),
  changedFiles: files,
  changedLines: Object.fromEntries(
    files.map((f) => [f, Array.from({ length: 30 }, (_, i) => i + 1)]),
  ),
})

const okSignals: Signals = {
  history: { status: 'ok' },
  metrics: { status: 'ok', items: [] },
  coverage: { status: 'ok', checkedFiles: 1, uncovered: [], notInReport: [] },
  dependencies: {
    status: 'ok',
    changed: [],
    lockfileEntries: [],
    advisories: { status: 'ok', items: [] },
  },
}

const spot = {
  file: 'src/domain/a.ts',
  line: 7,
  reason: 'Rounds the wrong way.',
  rule: 'domain-math',
}

function build(overrides: Partial<GuideInput> & { agent?: AgentAnswer } = {}): GuideData {
  return buildGuide({
    covers: 'a'.repeat(40),
    floor: floor('high', ['domain-math'], ['src/domain/a.ts', 'docs/x.md']),
    signals: okSignals,
    agent: { risk: 'high', categories: ['domain-math'], hotSpots: [spot] },
    catalogueNames: NAMES,
    ...overrides,
  })
}

describe('risk and categories', () => {
  it('raises the risk above the floor and says so', () => {
    const data = build({ agent: { risk: 'critical' } })
    expect(data.risk).toBe('critical')
    expect(renderVisible(data)).toContain('**critical**, raised from the floor high')
  })

  it('never goes below the floor, and notes it', () => {
    const data = build({ agent: { risk: 'low' } })
    expect(data.risk).toBe('high')
    expect(data.evidence).toContainEqual({
      kind: 'note',
      text: 'The reviewer rated the change low, below the floor high; the floor stands',
    })
  })

  it.each([undefined, 'severe', 3])('keeps the floor for the invalid risk %s', (risk) => {
    const data = build({ agent: { risk } })
    expect(data.risk).toBe('high')
    expect(data.evidence.some((e) => e.text.includes('no valid risk level'))).toBe(true)
  })

  it('unions the floor categories with the known ones the agent added', () => {
    const data = build({
      agent: { risk: 'high', categories: ['wire-contract', 'made-up'] },
    })
    expect(data.categories).toEqual(['domain-math', 'wire-contract'])
    expect(data.evidence).toContainEqual({
      kind: 'note',
      text: 'Dropped categories not in the catalogue: made-up',
    })
  })

  it('keeps a floor category the agent left out', () => {
    expect(build({ agent: { risk: 'high', categories: [] } }).categories).toEqual([
      'domain-math',
    ])
  })

  it('says so when no category matched', () => {
    const data = build({ floor: floor('low', [], ['src/x.ts']), agent: { risk: 'low' } })
    expect(renderVisible(data)).toContain('**low** — no category matched')
  })
})

describe('hot spots', () => {
  const dropped = (hotSpots: unknown[]) => build({ agent: { risk: 'high', hotSpots } })

  it('keeps a valid spot and defaults a missing rule to general', () => {
    const data = dropped([{ ...spot, rule: '' }])
    expect(data.hotSpots).toEqual([{ ...spot, rule: 'general' }])
  })

  it.each([
    ['a file that is not in the change', { ...spot, file: 'src/other.ts' }],
    ['a line that is not a positive integer', { ...spot, line: 0 }],
    ['a line the change did not touch', { ...spot, line: 99 }],
    ['a file the change did not touch', { ...spot, file: 'constructor' }],
    ['a fractional line', { ...spot, line: 1.5 }],
    ['a line given as text', { ...spot, line: '7' }],
    ['an empty reason', { ...spot, reason: '  ' }],
    ['something that is not an object', 'src/domain/a.ts:7'],
  ])('drops a spot with %s and notes it', (_label, bad) => {
    const data = dropped([bad])
    expect(data.hotSpots).toEqual([])
    expect(data.evidence).toContainEqual({
      kind: 'note',
      text: 'Dropped 1 hot spot(s) that are not a changed line of the change',
    })
  })

  it('shows at most eight, in the agent order', () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ ...spot, line: i + 1 }))
    const data = dropped(many)
    expect(data.hotSpots.map((s) => s.line)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(data.evidence).toContainEqual({
      kind: 'note',
      text: 'Showing 8 of 10 hot spots',
    })
  })

  it('puts a multi-line reason on one line', () => {
    expect(dropped([{ ...spot, reason: 'a\n\nb   c' }]).hotSpots[0]?.reason).toBe('a b c')
  })
})

describe('skim only and agent notes', () => {
  it('keeps valid skim items and agent notes, in that order after the script facts', () => {
    const data = build({
      agent: {
        risk: 'high',
        skimOnly: [{ file: 'docs/x.md', why: 'Text follows the code.' }, { file: 'x' }],
        evidenceNotes: ['Read the callers.', '', 7],
      },
    })
    expect(data.skimOnly).toEqual([{ file: 'docs/x.md', why: 'Text follows the code.' }])
    expect(data.evidence.at(-1)).toEqual({ kind: 'reviewer', text: 'Read the callers.' })
    expect(data.evidence.filter((e) => e.text === 'Read the callers.')).toHaveLength(1)
  })
})

describe('evidence from the signals', () => {
  it('reports what ran and what did not', () => {
    const evidence = evidenceFromSignals({
      ...okSignals,
      coverage: {
        status: 'ok',
        checkedFiles: 2,
        uncovered: ['a.ts:3', 'a.ts:4'],
        notInReport: ['b.ts'],
      },
      dependencies: {
        status: 'ok',
        changed: [{}],
        lockfileEntries: ['yaml@2.9.1'],
        advisories: {
          status: 'ok',
          items: [{ module: 'yaml', version: '2.9.1', severity: 'high', id: 'GHSA-1' }],
        },
      },
      metrics: { status: 'ok', items: ['src/a.ts: big'] },
    })
    expect(evidence).toEqual([
      {
        kind: 'checked',
        text: 'Changed-line coverage: 2 changed line(s) never ran: a.ts:3, a.ts:4',
      },
      { kind: 'not-checked', text: 'Changed-line coverage: no data for b.ts' },
      { kind: 'checked', text: 'Dependency audit: yaml@2.9.1 (high, GHSA-1)' },
      { kind: 'note', text: 'Metrics hotspots: src/a.ts: big' },
    ])
  })

  it('says every changed line ran, and nothing to check when no source changed', () => {
    expect(evidenceFromSignals(okSignals)[0]).toEqual({
      kind: 'checked',
      text: 'Changed-line coverage: every changed line ran in 1 source file(s)',
    })
    const none = evidenceFromSignals({
      ...okSignals,
      coverage: { status: 'ok', checkedFiles: 0, uncovered: [], notInReport: [] },
    })
    expect(none[0]?.text).toBe('Changed-line coverage: no source file changed')
  })

  it('lists a section that is not available as not checked', () => {
    const unavailable = {
      status: 'not available',
      reason: 'the coverage run took\nlonger than 120s',
    } as const
    const evidence = evidenceFromSignals({
      coverage: unavailable,
      dependencies: { status: 'not available', reason: 'git failed' },
      history: { status: 'not available', reason: 'no main' },
      metrics: { status: 'not available', reason: 'no main' },
    })
    expect(evidence.map((e) => e.kind)).toEqual([
      'not-checked',
      'not-checked',
      'not-checked',
      'not-checked',
    ])
    expect(evidence[0]?.text).toBe(
      'Changed-line coverage: the coverage run took longer than 120s',
    )
  })

  it('names a dependency audit that could not run while the diff is known', () => {
    const evidence = evidenceFromSignals({
      dependencies: {
        status: 'ok',
        changed: [{}],
        lockfileEntries: [],
        advisories: { status: 'not available', reason: 'offline' },
      },
    })
    expect(evidence).toContainEqual({
      kind: 'not-checked',
      text: 'Dependency audit: offline',
    })
  })

  it('does not claim a check when a signal was not given', () => {
    expect(evidenceFromSignals({}).map((e) => e.kind)).toEqual([
      'not-checked',
      'not-checked',
    ])
  })

  it('reports no dependency change', () => {
    expect(evidenceFromSignals(okSignals)).toContainEqual({
      kind: 'note',
      text: 'Dependencies: none changed',
    })
  })
})

describe('rendering and reading the body', () => {
  it('renders the four parts and the marker', () => {
    const visible = renderVisible(
      build({
        agent: {
          risk: 'high',
          hotSpots: [spot],
          skimOnly: [{ file: 'docs/x.md', why: 'Text.' }],
        },
      }),
    )
    expect(visible).toContain('Covers: `aaaaaaa`')
    expect(visible).toContain('### Risk\n\n**high** — `domain-math`')
    expect(visible).toContain(
      '1. `src/domain/a.ts:7` — Rounds the wrong way. (domain-math)',
    )
    expect(visible).toContain('### Skim only\n\n- `docs/x.md` — Text.')
    expect(visible).toContain('### Evidence\n\n- Checked:')
  })

  it('says None for empty parts', () => {
    const visible = renderVisible(build({ agent: { risk: 'high' }, signals: {} }))
    expect(visible).toContain('### Hot spots\n\nNone.')
    expect(visible).toContain('### Skim only\n\nNone.')
  })

  it('reads back exactly what it rendered, including text that looks like markup', () => {
    const nasty = {
      ...spot,
      reason: 'Ends the comment --> and opens <script> & "quotes" $& \\',
    }
    const data = build({ agent: { risk: 'high', hotSpots: [nasty] } })
    const parsed = parseGuide(`${renderGuide(data)}\n\nrest of the body`)
    expect(parsed?.data).toEqual(data)
    expect(parsed?.visible).toBe(renderVisible(data))
    // The data comment must close only where it ends, whatever the text says.
    const comment = renderGuide(data)
      .split('\n')
      .find((l) => l.startsWith('<!-- review-guide-data'))
    expect(comment?.split('-->')).toHaveLength(2)
  })

  it('reads a body that came back with Windows line endings', () => {
    const data = build()
    const parsed = parseGuide(`${renderGuide(data)}\n\nrest`.replace(/\n/g, '\r\n'))
    expect(parsed?.data).toEqual(data)
    expect(parsed?.visible).toBe(renderVisible(data))
  })

  it('keeps agent text from ending the block or breaking a code span', () => {
    const evil = {
      ...spot,
      file: 'src/domain/a.ts',
      reason: 'Ends it <!-- review-guide:end --> here',
      rule: 'a`b',
    }
    const data = build({
      agent: {
        risk: 'high',
        hotSpots: [evil],
        skimOnly: [{ file: 'docs/`x`.md', why: '--> done' }],
        evidenceNotes: ['<!-- note --!> <b>bold</b>'],
      },
    })
    const guide = renderGuide(data)
    expect(guide.split('<!-- review-guide:end -->')).toHaveLength(2)
    expect(renderVisible(data)).not.toMatch(/[<>]/)
    expect(renderVisible(data)).toContain('&lt;b&gt;bold&lt;/b&gt;')
    expect(parseGuide(guide)?.data).toEqual(data)
    expect(renderVisible(data)).toContain("`docs/'x'.md`")
    expect(replaceGuide(guide, guide).split('<!-- review-guide:start -->')).toHaveLength(
      2,
    )
  })

  it.each([
    ['an evidence item that is not an object', '"evidence":[', '"evidence":[null,'],
    ['an unknown evidence kind', '"kind":"checked"', '"kind":"mystery"'],
    ['a hot spot without a line', '"line":7', '"lin":7'],
    ['a risk that is not a level', '"risk":"high"', '"risk":"x"'],
  ])('does not read data with %s', (_label, from, to) => {
    const data = build({ signals: okSignals })
    const guide = renderGuide(data)
    expect(guide).toContain(from)
    expect(parseGuide(guide.replace(from, to))).toBeUndefined()
  })

  it('returns undefined when there is no guide or its data is damaged', () => {
    expect(parseGuide('just text')).toBeUndefined()
    const guide = renderGuide(build())
    expect(parseGuide(guide.replace('"version":1', '"version":2'))).toBeUndefined()
    expect(parseGuide(guide.replace('{"version"', '{"versio'))).toBeUndefined()
    expect(parseGuide(guide.replace('<!-- review-guide-data: ', ''))).toBeUndefined()
  })

  it('puts the guide at the top of a body that has none', () => {
    const guide = renderGuide(build())
    expect(replaceGuide('## Why the change\n\nBecause.', guide)).toBe(
      `${guide}\n\n## Why the change\n\nBecause.\n`,
    )
    expect(replaceGuide('', guide)).toBe(`${guide}\n`)
  })

  it('replaces the guide that is there and leaves the rest alone', () => {
    const old = renderGuide(build())
    const next = renderGuide(build({ covers: 'b'.repeat(40) }))
    const body = `${old}\n\n## Why the change\n\nBecause $& it.\n`
    expect(replaceGuide(body, next)).toBe(
      `${next}\n\n## Why the change\n\nBecause $& it.\n`,
    )
    expect(replaceGuide(body, `${next} $&`)).toContain(`${next} $&`)
  })
})

describe('parseAgentAnswer', () => {
  it('reads a fenced json block and bare json', () => {
    expect(parseAgentAnswer('```json\n{"risk":"high"}\n```')).toEqual({ risk: 'high' })
    expect(parseAgentAnswer('{"risk":"low"}')).toEqual({ risk: 'low' })
  })

  it.each(['not json', '[1]', 'null'])('rejects %s', (reply) => {
    expect(() => parseAgentAnswer(reply)).toThrow(/agent answer/)
  })
})
