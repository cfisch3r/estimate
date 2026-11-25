import { describe, expect, it } from 'vitest'
import { backLinks, readDoc } from './docs.ts'

describe('readDoc', () => {
  it('takes the title from the first heading and shortens a concept title', () => {
    const doc = readDoc(
      'docs/domain/concepts/live-collaboration.md',
      '# Live Collaboration — Domain Concept\n\nText',
    )
    expect(doc).toMatchObject({
      route: '/domain/concepts/live-collaboration',
      title: 'Live Collaboration — Domain Concept',
      shortTitle: 'Live Collaboration',
      side: 'domain',
    })
  })

  it('places a doc on the technical side, or shared outside both', () => {
    expect(readDoc('docs/technical/adr/010-x.md', '# ADR-010: X').side).toBe('technical')
    expect(readDoc('docs/glossary.md', '# Glossary').side).toBe('shared')
  })
})

describe('backLinks', () => {
  const spec = 'specs/live-session/e2e/late-joiner.feature'
  const sameName = 'specs/live-session/integration/late-joiner.feature'
  const domainDoc = readDoc(
    'docs/domain/concepts/live-collaboration.md',
    '# Live Collaboration — Domain Concept\n\n[late](../../../specs/live-session/e2e/late-joiner.feature)',
  )
  const technicalDoc = readDoc(
    'docs/technical/concepts/collaboration-mode.md',
    '# Live Collaboration Mode — Technical Concept\n\n[late](../../../specs/live-session/e2e/late-joiner.feature)',
  )

  it('lists every doc that links to a spec', () => {
    const { linkedFrom } = backLinks([domainDoc, technicalDoc], [spec])
    expect(linkedFrom.get(spec)?.map((d) => d.repoPath)).toEqual([
      domainDoc.repoPath,
      technicalDoc.repoPath,
    ])
  })

  it('reports a spec no doc links to, even when another spec has the same file name', () => {
    const { unlinked } = backLinks([domainDoc], [spec, sameName])
    expect(unlinked).toEqual([sameName])
  })
})
