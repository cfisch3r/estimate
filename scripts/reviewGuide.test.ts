// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { Floor } from './reviewFloor.ts'
import {
  buildGuide,
  evidenceFromSignals,
  githubUrl,
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
  title: 'Rounds the wrong way',
  body: 'The value is rounded down where it should round up.',
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
    expect(data.hotSpots).toEqual([{ ...spot, rule: 'general', facts: [] }])
  })

  it.each([
    ['a file that is not in the change', { ...spot, file: 'src/other.ts' }],
    ['a line that is not a positive integer', { ...spot, line: 0 }],
    ['a line the change did not touch', { ...spot, line: 99 }],
    ['a file the change did not touch', { ...spot, file: 'constructor' }],
    ['a fractional line', { ...spot, line: 1.5 }],
    ['a line given as text', { ...spot, line: '7' }],
    ['an empty title', { ...spot, title: '  ' }],
    ['an empty body', { ...spot, body: '' }],
    ['no title', { ...spot, title: undefined }],
    ['something that is not an object', 'src/domain/a.ts:7'],
  ])('drops a spot with %s and notes it', (_label, bad) => {
    const data = dropped([bad])
    expect(data.hotSpots).toEqual([])
    expect(data.evidence).toContainEqual({
      kind: 'warning',
      text: 'Dropped 1 hot spot(s) that are not a changed line of the change or have no title or body',
    })
  })

  it('shows at most eight, in the agent order', () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ ...spot, line: i + 1 }))
    const data = dropped(many)
    expect(data.hotSpots.map((s) => s.line)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(data.evidence).toContainEqual({
      kind: 'warning',
      text: 'Showing 8 of 10 hot spots',
    })
  })

  it('puts a multi-line body on one line', () => {
    expect(dropped([{ ...spot, body: 'a\n\nb   c' }]).hotSpots[0]?.body).toBe('a b c')
  })
})

describe('skim only and agent notes', () => {
  it('keeps valid skim items and agent notes, in that order after the script facts', () => {
    const data = build({
      agent: {
        risk: 'high',
        skimOnly: [{ file: 'docs/x.md', why: 'Text follows the code.' }, { file: 'x' }],
        notVerified: ['Read the callers.', '', 7],
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
      '1. **Rounds the wrong way**\n\n   The value is rounded down where it should round up.\n\n   `src/domain/a.ts:7` · domain-math',
    )
    expect(visible).toContain('### Skim only\n\n- `docs/x.md` — Text.')
    expect(visible).toContain('### Not verified\n\nNothing flagged.')
    expect(visible).toContain(
      '<details>\n<summary>Checked by the scripts</summary>\n\n- Checked:',
    )
  })

  it('says None for empty parts', () => {
    const visible = renderVisible(build({ agent: { risk: 'high' }, signals: {} }))
    expect(visible).toContain('### Hot spots\n\nNone.')
    expect(visible).toContain('### Skim only\n\nNone.')
  })

  it('reads back exactly what it rendered, including text that looks like markup', () => {
    const nasty = {
      ...spot,
      body: 'Ends the comment --> and opens <script> & "quotes" $& \\',
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
      body: 'Ends it <!-- review-guide:end --> here',
      rule: 'a`b',
    }
    const data = build({
      agent: {
        risk: 'high',
        hotSpots: [evil],
        skimOnly: [{ file: 'docs/`x`.md', why: '--> done' }],
        notVerified: ['<!-- note --!> <b>bold</b>'],
      },
    })
    const guide = renderGuide(data)
    expect(guide.split('<!-- review-guide:end -->')).toHaveLength(2)
    const withoutDetails = renderVisible(data).replace(
      /<\/?details>|<summary>.*<\/summary>/g,
      '',
    )
    expect(withoutDetails).not.toMatch(/[<>]/)
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
    ['a hot spot without a title', '"title":"Rounds', '"titl":"Rounds'],
    ['a hot spot without facts', '"facts":[]', '"fact":[]'],
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
    expect(parseGuide(guide.replace('"version":2', '"version":1'))).toBeUndefined()
    expect(parseGuide(guide.replace('{"version"', '{"versio'))).toBeUndefined()
    expect(parseGuide(guide.replace('<!-- review-guide-data: ', ''))).toBeUndefined()
  })

  it('puts the guide at the end of a body that has none', () => {
    const guide = renderGuide(build())
    expect(replaceGuide('## Why the change\n\nBecause.', guide)).toBe(
      `## Why the change\n\nBecause.\n\n${guide}\n`,
    )
    expect(replaceGuide('', guide)).toBe(`${guide}\n`)
  })

  it('replaces the guide that is there and leaves the rest alone', () => {
    const old = renderGuide(build())
    const next = renderGuide(build({ covers: 'b'.repeat(40) }))
    const body = `## Why the change\n\nBecause $& it.\n\n${old}\n`
    expect(replaceGuide(body, next)).toBe(
      `## Why the change\n\nBecause $& it.\n\n${next}\n`,
    )
    expect(replaceGuide(body, `${next} $&`)).toContain(`${next} $&`)
  })

  it('replaces a guide that sits at the top, where older bodies have it', () => {
    const old = renderGuide(build())
    const next = renderGuide(build({ covers: 'b'.repeat(40) }))
    expect(replaceGuide(`${old}\n\n## Why the change\n`, next)).toBe(
      `${next}\n\n## Why the change\n`,
    )
  })
})

describe('facts on hot spots', () => {
  const withSignals = (signals: Signals) => build({ signals }).hotSpots[0]?.facts

  it('says when no test runs the line', () => {
    expect(
      withSignals({
        ...okSignals,
        coverage: {
          status: 'ok',
          checkedFiles: 1,
          uncovered: ['src/domain/a.ts:7'],
          notInReport: [],
        },
      }),
    ).toEqual(['No test runs this line'])
  })

  it('says nothing about a line the coverage signal does not list', () => {
    expect(withSignals(okSignals)).toEqual([])
    expect(withSignals({})).toEqual([])
  })

  it('reports fix commits from two up', () => {
    const history = (fixes: number): Signals => ({
      history: {
        status: 'ok',
        since: '6 months',
        files: [{ path: 'src/domain/a.ts', fixes }],
      },
    })
    expect(withSignals(history(2))).toEqual(['2 fix commits in the last 6 months'])
    expect(withSignals(history(1))).toEqual([])
  })

  it('shows the facts under the reference, joined with a dot', () => {
    const visible = renderVisible(
      build({
        signals: {
          coverage: {
            status: 'ok',
            checkedFiles: 1,
            uncovered: ['src/domain/a.ts:7'],
            notInReport: [],
          },
          history: { status: 'ok', files: [{ path: 'src/domain/a.ts', fixes: 3 }] },
        },
      }),
    )
    expect(visible).toContain(
      '`src/domain/a.ts:7` · domain-math\n\n   Facts: No test runs this line · 3 fix commits in the last 6 months',
    )
  })
})

describe('not verified', () => {
  it('lists the script gaps and the agent gaps, and folds the checked facts', () => {
    const visible = renderVisible(
      build({
        signals: {
          ...okSignals,
          coverage: { status: 'not available', reason: 'timed out' },
        },
        agent: {
          risk: 'high',
          notVerified: ['Behaviour with an older peer is untested.'],
        },
      }),
    )
    expect(visible).toContain(
      '### Not verified\n\n- Changed-line coverage: timed out\n- Behaviour with an older peer is untested.\n\n<details>',
    )
    expect(visible).toContain('- Note: Dependencies: none changed')
    expect(visible).not.toContain('Reviewer note')
  })

  it('says nothing is flagged and adds no folded block when there is nothing to show', () => {
    const visible = renderVisible(
      build({ signals: { dependencies: undefined }, agent: { risk: 'high' } }),
    )
    expect(visible).not.toContain('<details>')
    const quiet = build({ agent: { risk: 'high' } })
    quiet.evidence = []
    expect(renderVisible(quiet)).toContain('### Not verified\n\nNothing flagged.')
    expect(renderVisible(quiet)).not.toContain('<details>')
  })

  it('ignores the old evidenceNotes field', () => {
    const data = build({
      agent: { risk: 'high', evidenceNotes: ['Read the callers.'] } as AgentAnswer,
    })
    expect(data.evidence.some((e) => e.text === 'Read the callers.')).toBe(false)
  })
})

describe('warnings and the guide block', () => {
  it('shows dropped hot spots under Not verified, not in the folded block', () => {
    const visible = renderVisible(
      build({ agent: { risk: 'high', hotSpots: [{ ...spot, line: 99 }] } }),
    )
    const [shown, folded] = visible.split('<details>')
    expect(shown).toContain('- Dropped 1 hot spot(s)')
    expect(folded).not.toContain('Dropped 1 hot spot(s)')
  })

  it('finds the guide when the description quotes the start marker earlier', () => {
    const guide = renderGuide(build())
    const body = `Quote: <!-- review-guide:start --> and <!-- review-guide:end -->\n\n${guide}\n`
    expect(parseGuide(body)?.data).toEqual(build())
    expect(replaceGuide(body, 'NEW')).toBe(
      'Quote: <!-- review-guide:start --> and <!-- review-guide:end -->\n\nNEW\n',
    )
  })

  it('writes plain text when the covered commit is not a full commit ID', () => {
    const visible = renderVisible(
      build({ covers: 'main', repoUrl: 'https://github.com/someone/estimate' }),
    )
    expect(visible).toContain('   `src/domain/a.ts:7` · domain-math')
    expect(visible).not.toContain('](')
  })
})

describe('the reference link', () => {
  const REPO = 'https://github.com/someone/estimate'
  const linked = (file: string) =>
    renderVisible(
      build({
        repoUrl: REPO,
        floor: floor('high', ['domain-math'], [file]),
        agent: { risk: 'high', hotSpots: [{ ...spot, file }] },
      }),
    )

  it('links to the file at the covered commit and the line', () => {
    expect(linked('src/domain/a.ts')).toContain(
      `[\`src/domain/a.ts:7\`](${REPO}/blob/${'a'.repeat(40)}/src/domain/a.ts#L7) · domain-math`,
    )
  })

  it('encodes spaces and parentheses so the link cannot end early', () => {
    expect(linked('src/my file (1).ts')).toContain(
      `/blob/${'a'.repeat(40)}/src/my%20file%20%281%29.ts#L7)`,
    )
  })

  it('writes plain text when there is no GitHub address', () => {
    const visible = renderVisible(build())
    expect(visible).toContain('   `src/domain/a.ts:7` · domain-math')
    expect(visible).not.toContain('](')
  })

  it('keeps the address in the data and refuses one that is not a GitHub repository', () => {
    const guide = renderGuide(build({ repoUrl: REPO }))
    expect(parseGuide(guide)?.data.repoUrl).toBe(REPO)
    expect(parseGuide(guide.replaceAll(REPO, 'https://evil.example/x/y'))).toBeUndefined()
    expect(parseGuide(guide.replaceAll(REPO, 'https://github.com/a/b)'))).toBeUndefined()
  })
})

describe('githubUrl', () => {
  it.each([
    ['https://github.com/cfisch3r/estimate.git', 'https://github.com/cfisch3r/estimate'],
    ['https://github.com/cfisch3r/estimate', 'https://github.com/cfisch3r/estimate'],
    [
      'https://user@github.com/cfisch3r/estimate.git\n',
      'https://github.com/cfisch3r/estimate',
    ],
    ['git@github.com:cfisch3r/estimate.git', 'https://github.com/cfisch3r/estimate'],
    [
      'ssh://git@github.com/cfisch3r/estimate.git',
      'https://github.com/cfisch3r/estimate',
    ],
    ['https://github.com/cfisch3r/estimate/', 'https://github.com/cfisch3r/estimate'],
  ])('reads %j', (remote, url) => {
    expect(githubUrl(remote)).toBe(url)
  })

  it.each([
    'https://gitlab.com/a/b.git',
    'git@github.com.evil.example:a/b.git',
    'https://github.com/a',
    '',
  ])('gives nothing for %j', (remote) => {
    expect(githubUrl(remote)).toBeUndefined()
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
