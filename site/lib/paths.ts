// Where a repo file ends up on the site, and where everything else is read on GitHub.

export const GITHUB_REPO = 'https://github.com/cfisch3r/estimate'
export const GITHUB_BLOB = `${GITHUB_REPO}/blob/main/`

/** The site is served by GitHub Pages as a project site, under the repo name. */
export const SITE_BASE = '/estimate/'

/** The docs the site leaves out: operations and review tooling, not the system's design. */
export const UNPUBLISHED_DOCS: readonly string[] = [
  'docs/technical/runbook.md',
  'docs/technical/pr-review-catalogue.md',
]

/**
 * The site route of a published repo file, without the site's base path:
 * `docs/domain/prd.md` → `/domain/prd`, `docs/README.md` → `/overview`,
 * `specs/live-session/e2e/late-joiner.feature` → `/specs/live-session/e2e/late-joiner`.
 */
export function routeOf(repoPath: string): string {
  if (repoPath === 'docs/README.md') return '/overview'
  if (repoPath.startsWith('docs/'))
    return '/' + repoPath.slice('docs/'.length).replace(/\.md$/, '')
  if (repoPath.startsWith('specs/')) return '/' + repoPath.replace(/\.feature$/, '')
  throw new Error(`not a published path: ${repoPath}`)
}

/** The Markdown file the build step writes for a route. */
export function contentFileOf(route: string): string {
  return route.slice(1) + '.md'
}
