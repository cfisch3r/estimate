import { describe, expect, it } from 'vitest'
import { readDoc } from './docs.ts'
import { buildSidebar, conceptName, type SpecEntry } from './sidebar.ts'
import { specsOverview } from './specsOverview.ts'

const docs = [
  readDoc('docs/README.md', '# EstiMate documentation'),
  readDoc('docs/domain/prd.md', '# PRD: EstiMate'),
  readDoc('docs/domain/concepts/screen-flow.md', '# Screen Flow — Domain Concept'),
  readDoc('docs/technical/architecture.md', '# EstiMate — Technical Architecture'),
  readDoc('docs/technical/adr/004-fsd.md', '# ADR-004: Feature-Sliced Design'),
  readDoc('docs/glossary.md', '# Glossary'),
]
const spec = (repoPath: string, scenarioCount = 2): SpecEntry => {
  const [, concept = '', level = ''] = repoPath.split('/')
  return {
    repoPath,
    route: '/' + repoPath.replace(/\.feature$/, ''),
    title: 'T',
    concept,
    level,
    scenarioCount,
  }
}
const specs = [
  spec('specs/live-session/e2e/late-joiner.feature'),
  spec('specs/live-session/domain/joining.feature', 1),
  spec('specs/live-session/integration/late-joiner.feature'),
]

describe('conceptName', () => {
  it('turns a folder name into a label', () => {
    expect(conceptName('live-session')).toBe('Live session')
  })
})

describe('buildSidebar', () => {
  const sidebar = buildSidebar(docs, specs)
  const group = (text: string) => sidebar.find((g) => g.text === text)

  it('groups the docs by side, with the decisions collapsed', () => {
    expect(sidebar.map((g) => g.text)).toEqual([
      'Start',
      'Domain',
      'Technical',
      'Decisions',
      'Specs',
      'Shared',
    ])
    expect(group('Domain')?.items?.map((i) => i.text)).toEqual([
      'Product requirements',
      'Screen Flow',
    ])
    expect(group('Technical')?.items?.map((i) => i.text)).toEqual([
      'Technical Architecture',
    ])
    expect(group('Decisions')).toMatchObject({
      collapsed: true,
      items: [{ text: '004 · Feature-Sliced Design' }],
    })
  })

  it('lists the specs of a concept by Test Level, named by file', () => {
    const liveSession = group('Specs')?.items?.find((i) => i.text === 'Live session')
    expect(liveSession?.items?.map((i) => i.text)).toEqual([
      'Joining · domain',
      'Late joiner · integration',
      'Late joiner · e2e',
    ])
  })
})

describe('specsOverview', () => {
  it('shows one card per spec under its concept, linked under the base path', () => {
    const page = specsOverview(specs, '/estimate/')
    expect(page).toContain('## Live session')
    expect(page).toContain(
      '<a class="spec-card" href="/estimate/specs/live-session/domain/joining">',
    )
    expect(page).toContain('1 scenario<')
    expect(page).toContain('2 scenarios<')
  })
})
