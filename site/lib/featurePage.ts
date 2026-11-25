import { AstBuilder, GherkinClassicTokenMatcher, Parser } from '@cucumber/gherkin'
import { IdGenerator } from '@cucumber/messages'
import type { Background, Examples, Scenario, Step, TableRow } from '@cucumber/messages'
import type { Doc } from './docs.ts'
import { GITHUB_BLOB } from './paths.ts'

const TEST_LEVELS: Record<string, string> = {
  domain: 'Rules of the domain model, checked without a browser',
  integration: 'An outbound adapter driven through its port in a real browser',
  e2e: 'The whole app, driven in real browsers',
}

export interface FeaturePage {
  readonly title: string
  readonly scenarioCount: number
  readonly markdown: string
}

/** Escapes text for HTML, and keeps Vue from reading `{{` as an interpolation. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\{\{/g, '&#123;&#123;')
}

/** A step's text with `"strings"` and `<placeholders>` marked up. Quotes go first, so the markup's own quotes stay untouched. */
export function stepText(text: string): string {
  return escapeHtml(text)
    .replace(/&quot;([^&]*?)&quot;/g, '<span class="g-string">“$1”</span>')
    .replace(/&lt;([^&]+?)&gt;/g, '<span class="g-param">$1</span>')
}

/** Gherkin description text as paragraphs: line breaks inside a paragraph are just wrapping. */
function paragraphs(description: string): string[] {
  return description
    .trim()
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, ' '))
    .filter((p) => p.length > 0)
}

function table(rows: readonly TableRow[], className: string): string {
  const [head, ...body] = rows
  if (head === undefined) return ''
  const cells = (row: TableRow, tag: 'th' | 'td') =>
    row.cells.map((cell) => `<${tag}>${escapeHtml(cell.value)}</${tag}>`).join('')
  const bodyRows = body.map((row) => `<tr>${cells(row, 'td')}</tr>`).join('')
  return `<table class="${className}"><thead><tr>${cells(head, 'th')}</tr></thead><tbody>${bodyRows}</tbody></table>`
}

function steps(list: readonly Step[]): string {
  let kind = 'given'
  const items = list.map((step) => {
    const keyword = step.keyword.trim()
    // And/But continue the kind of the step before, so they keep its colour.
    if (!['And', 'But', '*'].includes(keyword)) kind = keyword.toLowerCase()
    let argument = ''
    if (step.dataTable)
      argument = `<div class="g-arg">${table(step.dataTable.rows, 'g-datatable')}</div>`
    if (step.docString)
      argument = `<pre class="g-arg g-docstring">${escapeHtml(step.docString.content)}</pre>`
    return `<li class="g-step g-${kind}"><span class="g-kw">${escapeHtml(keyword)}</span><span class="g-text">${stepText(step.text)}</span>${argument}</li>`
  })
  // One line per step and no blank lines, so Markdown reads the list as a single HTML block.
  return `<ol class="g-steps">\n${items.join('\n')}\n</ol>`
}

function examples(list: readonly Examples[]): string {
  return list
    .map((ex) => {
      const name = ex.name ? `<p class="g-examples-name">${escapeHtml(ex.name)}</p>` : ''
      const rows = ex.tableHeader ? [ex.tableHeader, ...ex.tableBody] : []
      return `${name}<div class="g-examples">${table(rows, 'g-table')}</div>`
    })
    .join('\n\n')
}

function scenario(sc: Scenario, level: 2 | 3): string {
  const badges = [
    sc.examples.length > 0 ? '<Badge type="info" text="Examples" />' : '',
    sc.tags.some((t) => t.name === '@fail')
      ? '<Badge type="warning" text="Not built yet" />'
      : '',
  ].filter(Boolean)
  const heading = `${'#'.repeat(level)} ${escapeHtml(sc.name)}${badges.length ? ' ' + badges.join(' ') : ''}`
  const description = paragraphs(sc.description).map((p) => escapeHtml(p))
  return [heading, ...description, steps(sc.steps), examples(sc.examples)]
    .filter(Boolean)
    .join('\n\n')
}

function background(bg: Background): string {
  return `<div class="g-background"><p class="g-background-label">Before every scenario</p>\n${steps(bg.steps)}\n</div>`
}

function chips(
  specPath: string,
  level: string,
  linkedFrom: readonly Doc[],
  base: string,
): string {
  const docChip = (doc: Doc) => {
    const side =
      doc.side === 'shared' ? '' : `${doc.side === 'domain' ? 'Domain' : 'Technical'} · `
    return `<a class="g-chip g-chip-doc" href="${base}${doc.route.slice(1)}">${side}${escapeHtml(doc.shortTitle)}</a>`
  }
  const file = specPath.split('/').pop()!
  return [
    '<div class="g-meta">',
    `<span class="g-chip g-chip-level" title="${escapeHtml(TEST_LEVELS[level] ?? '')}">${escapeHtml(level)} test level</span>`,
    ...linkedFrom.map(docChip),
    `<a class="g-chip g-chip-file" href="${GITHUB_BLOB}${specPath}">${escapeHtml(file)}</a>`,
    '</div>',
  ].join('\n')
}

const parser = new Parser(
  new AstBuilder(IdGenerator.uuid()),
  new GherkinClassicTokenMatcher(),
)

/**
 * The page for one `.feature` file: its rules as sections, each scenario's
 * steps as a card, Examples as tables, the docs that link to it, and the
 * Gherkin source in a fold-out. `base` is the site's base path, for the raw
 * HTML links Markdown doesn't prefix.
 */
export function featurePage(
  source: string,
  specPath: string,
  linkedFrom: readonly Doc[],
  base: string,
): FeaturePage {
  const { feature } = parser.parse(source)
  if (!feature) throw new Error(`${specPath} has no Feature`)
  const level = specPath.split('/')[2] ?? ''
  const parts: string[] = []
  let scenarioCount = 0

  for (const child of feature.children) {
    if (child.background) parts.push(background(child.background))
    if (child.scenario) {
      parts.push(scenario(child.scenario, 2))
      scenarioCount++
    }
    if (child.rule) {
      const rule = child.rule
      parts.push(`## ${escapeHtml(rule.name)}`)
      for (const p of paragraphs(rule.description))
        parts.push(`<p class="g-rule-why">${escapeHtml(p)}</p>`)
      for (const rc of rule.children) {
        if (rc.background) parts.push(background(rc.background))
        if (rc.scenario) {
          parts.push(scenario(rc.scenario, 3))
          scenarioCount++
        }
      }
    }
  }

  const frontmatter = [
    '---',
    `title: ${JSON.stringify(feature.name)}`,
    `source: ${specPath}`,
    'outline: [2, 3]',
    '---',
  ].join('\n')
  const lede = paragraphs(feature.description).map(
    (p) => `<p class="g-lede">${escapeHtml(p)}</p>`,
  )
  const fence = '`'.repeat(
    Math.max(3, ...[...source.matchAll(/`+/g)].map((m) => m[0].length + 1)),
  )
  const sourceBlock = `<details class="g-source"><summary>Gherkin source</summary>\n\n${fence}gherkin\n${source.trimEnd()}\n${fence}\n\n</details>`

  const markdown = [
    frontmatter,
    `# ${escapeHtml(feature.name)}`,
    chips(specPath, level, linkedFrom, base),
    ...lede,
    ...parts,
    sourceBlock,
  ].join('\n\n')
  return { title: feature.name, scenarioCount, markdown: markdown + '\n' }
}
