import type { Doc } from './docs.ts'

export interface SpecEntry {
  readonly repoPath: string
  readonly route: string
  readonly title: string
  /** The concept folder: `specs/<concept>/<level>/…`. */
  readonly concept: string
  readonly level: string
  readonly scenarioCount: number
}

export interface SidebarItem {
  text: string
  link?: string
  collapsed?: boolean
  items?: SidebarItem[]
}

const LEVEL_ORDER = ['domain', 'integration', 'e2e']

/** A folder or file name as a label: `live-session` → `Live session` */
export function conceptName(concept: string): string {
  const words = concept.replace(/-/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

function byPath(a: { repoPath: string }, b: { repoPath: string }): number {
  return a.repoPath.localeCompare(b.repoPath)
}

function docItems(
  docs: readonly Doc[],
  prefix: string,
  label: (doc: Doc) => string,
): SidebarItem[] {
  return docs
    .filter((d) => d.repoPath.startsWith(prefix))
    .sort(byPath)
    .map((d) => ({ text: label(d), link: d.route }))
}

/** `ADR-004: Feature-Sliced Design as …` → `004 · Feature-Sliced Design as …` */
function adrLabel(doc: Doc): string {
  return doc.title.replace(/^ADR-(\d+):\s*/, '$1 · ')
}

/** The sidebar, built from the folder structure: docs by side, specs by concept and Test Level. */
export function buildSidebar(
  docs: readonly Doc[],
  specs: readonly SpecEntry[],
): SidebarItem[] {
  const find = (repoPath: string) => docs.filter((d) => d.repoPath === repoPath)
  const short = (d: Doc) => d.shortTitle

  const technicalTop = docs
    .filter((d) => /^docs\/technical\/[^/]+\.md$/.test(d.repoPath))
    .sort(byPath)
    .map((d) => ({ text: d.shortTitle.replace(/^EstiMate — /, ''), link: d.route }))

  const concepts = [...new Set(specs.map((s) => s.concept))].sort()
  const specGroups: SidebarItem[] = concepts.map((concept) => ({
    text: conceptName(concept),
    collapsed: true,
    items: specs
      .filter((s) => s.concept === concept)
      .sort(
        (a, b) =>
          LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level) ||
          a.repoPath.localeCompare(b.repoPath),
      )
      .map((s) => ({
        text: `${conceptName(
          s.repoPath
            .split('/')
            .pop()!
            .replace(/\.feature$/, ''),
        )} · ${s.level}`,
        link: s.route,
      })),
  }))

  return [
    {
      text: 'Start',
      items: find('docs/README.md').map((d) => ({ text: 'Overview', link: d.route })),
    },
    {
      text: 'Domain',
      items: [
        ...find('docs/domain/prd.md').map((d) => ({
          text: 'Product requirements',
          link: d.route,
        })),
        ...docItems(docs, 'docs/domain/concepts/', short),
      ],
    },
    {
      text: 'Technical',
      items: [...technicalTop, ...docItems(docs, 'docs/technical/concepts/', short)],
    },
    {
      text: 'Decisions',
      collapsed: true,
      items: docItems(docs, 'docs/technical/adr/', adrLabel),
    },
    { text: 'Specs', items: [{ text: 'All specs', link: '/specs/' }, ...specGroups] },
    {
      text: 'Shared',
      items: find('docs/glossary.md').map((d) => ({ text: d.title, link: d.route })),
    },
  ].filter((group) => group.items.length > 0)
}
