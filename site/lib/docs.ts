import { featureLinks } from './links.ts'
import { routeOf } from './paths.ts'

type DocSide = 'domain' | 'technical' | 'shared'

export interface Doc {
  readonly repoPath: string
  /** The doc's page on the site, without the base path. */
  readonly route: string
  /** The doc's first `# ` heading. */
  readonly title: string
  /** The title without the " — Domain Concept" / " — Technical Concept" suffix. */
  readonly shortTitle: string
  readonly side: DocSide
  readonly markdown: string
}

export function readDoc(repoPath: string, markdown: string): Doc {
  const title = /^# (.+)$/m.exec(markdown)?.[1]?.trim() ?? repoPath
  const shortTitle = title.replace(/\s+—\s+(Domain|Technical) Concept$/, '')
  const side: DocSide = repoPath.startsWith('docs/domain/')
    ? 'domain'
    : repoPath.startsWith('docs/technical/')
      ? 'technical'
      : 'shared'
  return { repoPath, route: routeOf(repoPath), title, shortTitle, side, markdown }
}

export interface BackLinks {
  /** For each spec, the docs that link to it, in the order of `docs`. */
  readonly linkedFrom: ReadonlyMap<string, readonly Doc[]>
  /** Specs no doc links to. The build refuses these: every spec belongs to a doc's rule. */
  readonly unlinked: readonly string[]
}

/** Turns the docs' links to `.feature` files around, so each spec page can name its docs. */
export function backLinks(docs: readonly Doc[], specs: readonly string[]): BackLinks {
  const linkedFrom = new Map<string, Doc[]>(specs.map((spec) => [spec, []]))
  for (const doc of docs) {
    for (const spec of featureLinks(doc.markdown, doc.repoPath))
      linkedFrom.get(spec)?.push(doc)
  }
  const unlinked = specs.filter((spec) => linkedFrom.get(spec)!.length === 0)
  return { linkedFrom, unlinked }
}
