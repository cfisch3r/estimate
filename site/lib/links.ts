import { posix } from 'node:path'
import { GITHUB_BLOB, routeOf } from './paths.ts'

// A Markdown link or image target: `](target)` or `](target#anchor)`. Titles in
// link targets aren't used in the docs, so the target ends at the first space or `)`.
const LINK = /\]\(([^)#\s]+)(#[^)\s]*)?\)/g
const EXTERNAL = /^[a-z][a-z0-9+.-]*:/i

/** The repo path a relative link in `fromRepoPath` points to, or `undefined` for an external link. */
function resolveTarget(fromRepoPath: string, target: string): string | undefined {
  if (EXTERNAL.test(target) || target.startsWith('/')) return undefined
  return posix.normalize(posix.join(posix.dirname(fromRepoPath), target))
}

export interface LinkTargets {
  /** Docs and specs that have a page on the site. */
  readonly pages: ReadonlySet<string>
  /** Other files copied to the site as they are, such as images. */
  readonly assets: ReadonlySet<string>
}

/**
 * Rewrites the relative links in a doc so they work on the site: a link to a
 * published doc or spec goes to its page, a link to a copied asset stays
 * relative, and a link to anything else goes to the file on GitHub.
 */
export function rewriteLinks(
  markdown: string,
  fromRepoPath: string,
  targets: LinkTargets,
): string {
  return markdown.replace(LINK, (link, target: string, anchor: string = '') => {
    const repoPath = resolveTarget(fromRepoPath, target)
    if (repoPath === undefined || targets.assets.has(repoPath)) return link
    if (targets.pages.has(repoPath)) return `](${routeOf(repoPath)}${anchor})`
    return `](${GITHUB_BLOB}${repoPath}${anchor})`
  })
}

/** The repo paths of the `.feature` files a doc links to. */
export function featureLinks(markdown: string, fromRepoPath: string): string[] {
  const found = new Set<string>()
  for (const [, target] of markdown.matchAll(LINK)) {
    const repoPath = resolveTarget(fromRepoPath, target!)
    if (repoPath?.endsWith('.feature')) found.add(repoPath)
  }
  return [...found]
}
