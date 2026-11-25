import { describe, expect, it } from 'vitest'
import { readDoc } from './docs.ts'
import { escapeHtml, featurePage, stepText } from './featurePage.ts'

const specPath = 'specs/estimation-method/domain/aggregation.feature'
const concept = readDoc(
  'docs/domain/concepts/estimation-method.md',
  '# Estimation Method — Domain Concept',
)

const source = `Feature: An item's group range

  At reveal, the estimates become one group range.

  Background:
    Given the session is estimated in days

  Rule: The group range keeps the extremes

    Don't average the \`outliers\` away.

    Scenario: Three estimates give one group range
      Given the estimates
        | participant | best |
        | Ana         | 2    |
      When they are aggregated
      And the "Reveal" button is pressed
      Then the group range is <range>

      Examples:
        | range |
        | 2–8   |

  @fail
  Scenario: Not built *yet*
    Then nothing happens
`

describe('stepText', () => {
  it('marks up strings and placeholders, keeping every character', () => {
    expect(stepText('the 90% value is <90% value> for "Ana"')).toBe(
      'the 90% value is <span class="g-param">90% value</span> for <span class="g-string">&quot;Ana&quot;</span>',
    )
  })

  it('keeps the double quotes inside a single-quoted string as part of it', () => {
    expect(stepText(`the saved file contains exactly '{"items":[]}'`)).toBe(
      `the saved file contains exactly <span class="g-string">'{&quot;items&quot;:[]}'</span>`,
    )
  })

  it("doesn't read an apostrophe as the start of a string", () => {
    expect(stepText(`Imogen's report does not mention "Imogen" or the team's item`)).toBe(
      `Imogen's report does not mention <span class="g-string">&quot;Imogen&quot;</span> or the team's item`,
    )
  })
})

describe('escapeHtml', () => {
  it('keeps Vue from reading text as an interpolation', () => {
    expect(escapeHtml('{{ x }} <b>')).toBe('&#123;&#123; x }} &lt;b&gt;')
  })
})

describe('featurePage', () => {
  const page = featurePage(source, specPath, [concept], '/estimate/')

  it('names the page after the feature and counts its scenarios', () => {
    expect(page.title).toBe("An item's group range")
    expect(page.scenarioCount).toBe(2)
  })

  it('records the source file for the edit link', () => {
    expect(page.markdown).toMatch(
      /^---\ntitle: "An item's group range"\nsource: specs\/estimation-method/,
    )
  })

  it('shows the Test Level and links to the docs that link here, under the base path', () => {
    expect(page.markdown).toContain('domain test level')
    expect(page.markdown).toContain(
      '<a class="g-chip g-chip-doc" href="/estimate/domain/concepts/estimation-method">Domain · Estimation Method</a>',
    )
  })

  it('turns rules into sections and scenarios into step cards', () => {
    expect(page.markdown).toContain('## The group range keeps the extremes')
    // The description stays Markdown, so its `code` renders like anywhere else.
    expect(page.markdown).toContain(
      '<div class="g-rule-why">\n\nDon\'t average the `outliers` away.\n\n</div>',
    )
    expect(page.markdown).toContain(
      '### Three estimates give one group range <Badge type="info" text="Examples" />',
    )
    expect(page.markdown).toContain(
      '<li class="g-step g-when"><span class="g-kw">When</span>',
    )
  })

  it('gives an And step the kind of the step before it', () => {
    expect(page.markdown).toContain(
      '<li class="g-step g-when"><span class="g-kw">And</span>',
    )
  })

  it('renders data tables, examples and the background', () => {
    expect(page.markdown).toContain(
      '<table class="g-datatable"><thead><tr><th>participant</th><th>best</th>',
    )
    expect(page.markdown).toContain(
      '<table class="g-table"><thead><tr><th>range</th></tr></thead><tbody><tr><td>2–8</td>',
    )
    expect(page.markdown).toContain(
      '<p class="g-background-label">Before every scenario</p>',
    )
  })

  it('marks a scenario tagged @fail as not built yet, keeping Markdown characters in its name literal', () => {
    expect(page.markdown).toContain(
      '## Not built \\*yet\\* <Badge type="warning" text="Not built yet" />',
    )
  })

  it('keeps the Gherkin source in a fold-out', () => {
    expect(page.markdown).toContain("```gherkin\nFeature: An item's group range")
  })

  it('refuses a file without a Feature', () => {
    expect(() => featurePage('# just a comment\n', specPath, [], '/')).toThrow(
      'has no Feature',
    )
  })
})
