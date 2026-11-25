// The site's build step: reads docs/ and specs/, writes the Markdown VitePress
// builds from into site/content/, and the sidebar into site/.vitepress/generated/.
// Fails when a spec is linked from no doc.
import { cpSync, globSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { backLinks, readDoc } from '../lib/docs.ts'
import { featurePage } from '../lib/featurePage.ts'
import { rewriteLinks } from '../lib/links.ts'
import { contentFileOf, routeOf, SITE_BASE, UNPUBLISHED_DOCS } from '../lib/paths.ts'
import { buildSidebar, type SpecEntry } from '../lib/sidebar.ts'
import { specsOverview } from '../lib/specsOverview.ts'

const site = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const repo = resolve(site, '..')
const content = join(site, 'content')
const generated = join(site, '.vitepress', 'generated')

const glob = (pattern: string) => globSync(pattern, { cwd: repo }).sort()
const read = (repoPath: string) => readFileSync(join(repo, repoPath), 'utf8')
function write(path: string, text: string) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, text)
}

const docPaths = glob('docs/**/*.md').filter((p) => !UNPUBLISHED_DOCS.includes(p))
const assetPaths = glob('docs/**/*.*').filter((p) => !p.endsWith('.md'))
const specPaths = glob('specs/**/*.feature')

const docs = docPaths.map((p) => readDoc(p, read(p)))
const { linkedFrom, unlinked } = backLinks(docs, specPaths)
if (unlinked.length > 0) {
  console.error(
    'These specs are linked from no doc. Link each from the doc rule it checks:\n' +
      unlinked.map((p) => `  ${p}`).join('\n'),
  )
  process.exit(1)
}

rmSync(content, { recursive: true, force: true })
cpSync(join(site, 'pages'), content, { recursive: true })

const targets = {
  pages: new Set([...docPaths, ...specPaths]),
  assets: new Set(assetPaths),
}
for (const doc of docs) {
  const frontmatter = `---\nsource: ${doc.repoPath}\n---\n\n`
  write(
    join(content, contentFileOf(doc.route)),
    frontmatter + rewriteLinks(doc.markdown, doc.repoPath, targets),
  )
}
for (const asset of assetPaths) {
  cpSync(join(repo, asset), join(content, asset.slice('docs/'.length)))
}

const specs: SpecEntry[] = specPaths.map((specPath) => {
  const page = featurePage(
    read(specPath),
    specPath,
    linkedFrom.get(specPath) ?? [],
    SITE_BASE,
  )
  const route = routeOf(specPath)
  write(join(content, contentFileOf(route)), page.markdown)
  const [, concept = '', level = ''] = specPath.split('/')
  return {
    repoPath: specPath,
    route,
    title: page.title,
    concept,
    level,
    scenarioCount: page.scenarioCount,
  }
})
write(join(content, 'specs', 'index.md'), specsOverview(specs, SITE_BASE))
write(join(generated, 'sidebar.json'), JSON.stringify(buildSidebar(docs, specs), null, 2))

console.log(
  `site content: ${docs.length} docs, ${specs.length} specs, ${assetPaths.length} assets`,
)
