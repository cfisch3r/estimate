import { readFileSync } from 'node:fs'
import { defineConfig } from 'vitepress'
import { GITHUB_REPO, SITE_BASE } from '../lib/paths.ts'

// Written by scripts/generate.ts, which runs before every dev and build.
const sidebar = JSON.parse(
  readFileSync(new URL('./generated/sidebar.json', import.meta.url), 'utf8'),
)

export default defineConfig({
  title: 'EstiMate',
  description: 'The domain model, technical design and executable specs of EstiMate',
  base: SITE_BASE,
  srcDir: 'content',
  appearance: 'dark',
  cleanUrls: true,
  head: [
    ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }],
    [
      'link',
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
      },
    ],
  ],
  markdown: {
    theme: { light: 'github-light', dark: 'one-dark-pro' },
    config(md) {
      // A ```mermaid fence becomes the <Mermaid> component, which draws it in the browser.
      const fence = md.renderer.rules.fence!
      md.renderer.rules.fence = (tokens, idx, options, env, self) => {
        const token = tokens[idx]!
        if (token.info.trim() !== 'mermaid') return fence(tokens, idx, options, env, self)
        return `<Mermaid code="${encodeURIComponent(token.content)}" />`
      }
    },
  },
  themeConfig: {
    siteTitle: 'EstiMate docs',
    nav: [
      { text: 'Overview', link: '/overview' },
      { text: 'Domain', link: '/domain/prd' },
      { text: 'Technical', link: '/technical/architecture' },
      { text: 'Specs', link: '/specs/' },
      { text: 'Glossary', link: '/glossary' },
    ],
    sidebar,
    search: { provider: 'local' },
    outline: { level: [2, 3], label: 'On this page' },
    socialLinks: [{ icon: 'github', link: GITHUB_REPO }],
    editLink: {
      // Every generated page names its source file: a doc under docs/, or a .feature file.
      // VitePress sends this function to the browser as source text, so it can't use
      // anything from outside it, and the repo URL is written out.
      pattern: ({ frontmatter }) =>
        `https://github.com/cfisch3r/estimate/edit/main/${frontmatter.source}`,
      text: 'Edit on GitHub',
    },
  },
})
