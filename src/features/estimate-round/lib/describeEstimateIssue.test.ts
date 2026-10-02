import { describe, expect, it } from 'vitest'
import { describeEstimateIssue, describePartialOrdering } from './describeEstimateIssue'

const values = { best: 8, likely: 5, worst: 9 }

describe('describeEstimateIssue', () => {
  it('names both numbers and says what to change for best above likely', () => {
    const issue = describeEstimateIssue(
      { code: 'best-above-likely', fields: ['best', 'likely'] },
      values,
      'days',
    )

    expect(issue).toEqual({
      headline: 'Out of order',
      message:
        'Best case (8 days) is higher than Most likely (5 days). Lower Best case or raise Most likely.',
      fields: ['best', 'likely'],
    })
  })

  it('describes likely above worst', () => {
    const issue = describeEstimateIssue(
      { code: 'likely-above-worst', fields: ['likely', 'worst'] },
      { best: 2, likely: 9, worst: 8 },
      'hours',
    )

    expect(issue.message).toBe(
      'Most likely (9 hours) is higher than Worst case (8 hours). Lower Most likely or raise Worst case.',
    )
    expect(issue.fields).toEqual(['likely', 'worst'])
  })

  it('uses the singular unit for 1', () => {
    const issue = describeEstimateIssue(
      { code: 'best-above-likely', fields: ['best', 'likely'] },
      { best: 1, likely: 0.5, worst: 2 },
      'weeks',
    )

    expect(issue.message).toContain('Best case (1 week)')
    expect(issue.message).toContain('Most likely (0.5 weeks)')
  })

  it('asks for a positive best case', () => {
    const issue = describeEstimateIssue(
      { code: 'non-positive', fields: ['best'] },
      { best: 0, likely: 3, worst: 5 },
      'days',
    )

    expect(issue.headline).toBe('Enter a positive value')
    expect(issue.message).toContain('Best case (0 days) must be greater than 0')
    expect(issue.fields).toEqual(['best'])
  })

  it('names every field that is not a number', () => {
    const issue = describeEstimateIssue(
      { code: 'not-finite', fields: ['best', 'worst'] },
      { best: NaN, likely: 3, worst: NaN },
      'days',
    )

    expect(issue.headline).toBe('Enter a number')
    expect(issue.message).toContain('Best case and Worst case must be a number')
    expect(issue.fields).toEqual(['best', 'worst'])
  })
})

describe('describePartialOrdering', () => {
  it('flags a descending pair before the third value is typed', () => {
    const issue = describePartialOrdering({ best: 10, likely: 5, worst: null }, 'days')

    expect(issue?.message).toContain(
      'Best case (10 days) is higher than Most likely (5 days)',
    )
    expect(issue?.fields).toEqual(['best', 'likely'])
  })

  it('checks best against worst when likely is missing', () => {
    const issue = describePartialOrdering({ best: 9, likely: null, worst: 4 }, 'days')

    expect(issue?.fields).toEqual(['best', 'worst'])
  })

  it('returns null when no filled pair descends', () => {
    expect(
      describePartialOrdering({ best: 1, likely: null, worst: 4 }, 'days'),
    ).toBeNull()
    expect(
      describePartialOrdering({ best: null, likely: null, worst: null }, 'days'),
    ).toBeNull()
  })
})
