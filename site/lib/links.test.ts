import { describe, expect, it } from 'vitest'
import { featureLinks, rewriteLinks } from './links.ts'
import { routeOf } from './paths.ts'

const targets = {
  pages: new Set([
    'docs/glossary.md',
    'docs/domain/concepts/estimation-method.md',
    'docs/README.md',
    'specs/estimation-method/domain/aggregation.feature',
  ]),
  assets: new Set(['docs/domain/assets/three-point-estimation.svg']),
}
const from = 'docs/domain/concepts/estimation-method.md'

describe('routeOf', () => {
  it('gives each published file its page', () => {
    expect(routeOf('docs/domain/prd.md')).toBe('/domain/prd')
    expect(routeOf('docs/README.md')).toBe('/overview')
    expect(routeOf('specs/live-session/e2e/late-joiner.feature')).toBe(
      '/specs/live-session/e2e/late-joiner',
    )
  })

  it('refuses a file outside docs/ and specs/', () => {
    expect(() => routeOf('src/main.tsx')).toThrow('not a published path')
  })
})

describe('rewriteLinks', () => {
  it('points a link to a published doc at its page, keeping the anchor', () => {
    expect(rewriteLinks('[g](../../glossary.md#test-level)', from, targets)).toBe(
      '[g](/glossary#test-level)',
    )
  })

  it('points a link to a spec at its spec page', () => {
    expect(
      rewriteLinks(
        '[a](../../../specs/estimation-method/domain/aggregation.feature)',
        from,
        targets,
      ),
    ).toBe('[a](/specs/estimation-method/domain/aggregation)')
  })

  it('leaves a link to a copied asset as it is', () => {
    const image = '![range](../assets/three-point-estimation.svg)'
    expect(rewriteLinks(image, from, targets)).toBe(image)
  })

  it('sends a link to an unpublished file to GitHub', () => {
    expect(rewriteLinks('[r](../../technical/runbook.md#secrets)', from, targets)).toBe(
      '[r](https://github.com/cfisch3r/estimate/blob/main/docs/technical/runbook.md#secrets)',
    )
    expect(
      rewriteLinks('[c](../../../src/domain/estimate/estimate.ts)', from, targets),
    ).toBe(
      '[c](https://github.com/cfisch3r/estimate/blob/main/src/domain/estimate/estimate.ts)',
    )
  })

  it('leaves external links and same-page anchors alone', () => {
    const md = '[w](https://example.com/a.md) [s](#rules) [m](mailto:someone@example.com)'
    expect(rewriteLinks(md, from, targets)).toBe(md)
  })
})

describe('featureLinks', () => {
  it('lists each linked spec once, resolved from the doc', () => {
    const md =
      '[a](../../../specs/estimation-method/domain/aggregation.feature) ' +
      '[again](../../../specs/estimation-method/domain/aggregation.feature) [g](../../glossary.md)'
    expect(featureLinks(md, from)).toEqual([
      'specs/estimation-method/domain/aggregation.feature',
    ])
  })
})
