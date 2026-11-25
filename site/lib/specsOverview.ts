import { escapeHtml } from './featurePage.ts'
import { conceptName, type SpecEntry } from './sidebar.ts'

/** The specs overview page: one card per spec, grouped by concept folder. */
export function specsOverview(specs: readonly SpecEntry[], base: string): string {
  const concepts = [...new Set(specs.map((s) => s.concept))].sort()
  const groups = concepts.map((concept) => {
    const cards = specs
      .filter((s) => s.concept === concept)
      .map(
        (s) =>
          `<a class="spec-card" href="${base}${s.route.slice(1)}">` +
          `<span class="spec-card-level">${escapeHtml(s.level)}</span>` +
          `<span class="spec-card-name">${escapeHtml(s.title)}</span>` +
          `<span class="spec-card-count">${s.scenarioCount} ${s.scenarioCount === 1 ? 'scenario' : 'scenarios'}</span>` +
          '</a>',
      )
    return `## ${conceptName(concept)}\n\n<div class="spec-cards">\n${cards.join('\n')}\n</div>`
  })
  return [
    '---\ntitle: Specs\neditLink: false\n---',
    '# Specs',
    'The executable Gherkin specs, rendered for reading. Each one runs on every change at its ' +
      '**Test Level**: `domain` specs check the rules of the domain model without a browser, ' +
      '`integration` specs drive one outbound adapter in a real browser, and `e2e` specs drive the ' +
      'whole app. Each spec page links to the docs whose rules it checks.',
    ...groups,
  ].join('\n\n')
}
