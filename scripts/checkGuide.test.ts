// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { checkGuide, type CheckInput } from './checkGuide.ts'
import type { Floor } from './reviewFloor.ts'
import { buildGuide, renderGuide, renderVisible, type GuideData } from './reviewGuide.ts'

// The check script catches what a reader cannot see: a guide below the floor or a guide
// edited by hand. Each case plants one defect in an
// otherwise valid body and checks that exactly that problem is reported.
const COVERS = 'a'.repeat(40)
const FILES = ['src/domain/a.ts']

const floorOf = (risk: Floor['floor'], names: string[]): Floor => ({
  floor: risk,
  categories: names.map((name) => ({
    name,
    minRisk: risk,
    files: FILES,
    diffChecks: [],
  })),
  changedFiles: FILES,
  changedLines: { 'src/domain/a.ts': [1, 2, 3, 4, 5, 6, 7, 8] },
})

const FLOOR = floorOf('high', ['domain-math'])

function guideData(overrides: Partial<GuideData> = {}): GuideData {
  const data = buildGuide({
    covers: COVERS,
    floor: FLOOR,
    signals: {},
    agent: {
      risk: 'high',
      hotSpots: [
        {
          file: 'src/domain/a.ts',
          line: 7,
          title: 'Rounds the wrong way',
          body: 'The value is rounded down where it should round up.',
          rule: 'domain-math',
        },
      ],
    },
    catalogueNames: ['domain-math', 'mechanical'],
  })
  return { ...data, ...overrides }
}

const bodyOf = (data: GuideData = guideData()) =>
  `${renderGuide(data)}\n\n## Why the change\n\nBecause.\n`

function check(overrides: Partial<CheckInput> = {}) {
  return checkGuide({
    body: bodyOf(),
    floor: FLOOR,
    ...overrides,
  })
}

describe('a valid guide', () => {
  it('passes', () => {
    expect(check()).toEqual({ status: 'ok', problems: [] })
  })

  it('passes with Windows line endings, as GitHub can return them', () => {
    expect(check({ body: bodyOf().replace(/\n/g, '\r\n') }).status).toBe('ok')
  })

  it('passes when a guide is above the floor', () => {
    expect(check({ body: bodyOf(guideData({ risk: 'critical' })) }).status).toBe('ok')
  })
})

describe('missing or skipped guide', () => {
  it('fails when there is no guide', () => {
    expect(check({ body: '## Why the change\n\nBecause.\n' })).toEqual({
      status: 'failed',
      problems: ['There is no Review guide in the body.'],
    })
  })

  it('accepts a skip line with a reason', () => {
    expect(
      check({
        body: 'Review guide: skipped (typo fix in one doc)\n\n## Why the change\n',
      }),
    ).toEqual({ status: 'skipped', reason: 'typo fix in one doc', problems: [] })
  })

  it.each([
    'Review guide: skipped ()',
    'Review guide: skipped (   )',
    'Review guide: skipped',
  ])('fails the skip line %j', (line) => {
    expect(check({ body: line }).status).toBe('failed')
  })

  it('checks the guide when a skip line sits next to a guide', () => {
    const body = `${bodyOf(guideData({ risk: 'low' }))}\nReview guide: skipped (trivial)\n`
    expect(check({ body }).status).toBe('failed')
  })
})

describe('structure and hand edits', () => {
  it.each([
    ['Risk', '### Risk'],
    ['Hot spots', '### Hot spots'],
    ['Skim only', '### Skim only'],
    ['Not verified', '### Not verified'],
  ])('fails when the %s part is removed', (name, heading) => {
    const result = check({ body: bodyOf().replace(`\n${heading}\n`, '\n### Other\n') })
    expect(result.problems).toContain(`The part "${name}" is missing.`)
  })

  it('fails when the marker line is removed', () => {
    const result = check({ body: bodyOf().replace(/^Covers: .*\n/m, '') })
    expect(result.problems).toContain('The `Covers:` marker is missing.')
  })

  it('fails when the visible text was edited by hand', () => {
    const result = check({
      body: bodyOf().replace('rounded down where it should round up', 'fine'),
    })
    expect(result.status).toBe('failed')
    expect(result.problems[0]).toMatch(/edited by hand/)
  })

  it('fails when the data comment is damaged', () => {
    const result = check({ body: bodyOf().replace('{"version":2', '{"version":') })
    expect(result.problems[0]).toMatch(/data is missing or damaged/)
  })

  it.each([
    '"categories":["domain-math"],',
    '"risk":"high",',
    '"hotSpots":[',
    '"covers":"',
  ])('fails, without throwing, when the data lacks %s', (piece) => {
    const body = bodyOf()
    const broken = body.replace(piece, piece.replace(/^"(\w+)"/, '"x$1"'))
    expect(broken).not.toBe(body)
    const result = check({ body: broken })
    expect(result.status).toBe('failed')
    expect(result.problems[0]).toMatch(/data is missing or damaged/)
  })

  it('does not trust hidden data that was edited to match a lowered risk', () => {
    const data = guideData({ risk: 'low', floor: 'low' })
    // The data and the text agree, so only the floor comparison can catch it.
    expect(renderVisible(data)).toContain('**low**')
    expect(check({ body: bodyOf(data) }).problems[0]).toMatch(
      /^The guide says low, below the floor high\. /,
    )
  })
})

describe('floor', () => {
  it('fails when the risk is below the floor', () => {
    const result = check({ floor: floorOf('critical', ['domain-math']) })
    expect(result.problems[0]).toMatch(
      /^The guide says high, below the floor critical\. /,
    )
  })

  it('fails when a matched category is missing', () => {
    const result = check({ floor: floorOf('high', ['domain-math', 'wire-contract']) })
    expect(result.problems).toContain(
      'The guide leaves out matched categories: wire-contract.',
    )
  })

  it('reports every problem at once', () => {
    const result = check({ floor: floorOf('critical', ['domain-math', 'wire-contract']) })
    expect(result.problems).toHaveLength(2)
  })
})
