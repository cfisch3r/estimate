import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { escapeUTF8 as esc } from 'entities'
import type { ChangesetMap, Folder } from './reviewMap.ts'

// The changeset map section of the Review guide. The map data goes into the page as a JSON
// block; a small script (changesetMap.client.js, inlined) lays it out in the browser and
// draws the import arrows, so a reader can collapse and open folders, pin a box and hide a
// kind of arrow. Nothing is loaded from outside the page.

const CLIENT = readFileSync(join(import.meta.dirname, 'changesetMap.client.js'), 'utf8')

const STYLE = readFileSync(join(import.meta.dirname, 'changesetMap.css'), 'utf8')

// The same signs as the file boxes, so the legend does not rest on colour alone.
const SWATCHES: Array<[string, string]> = [
  ['added', '+ added'],
  ['changed', '~ changed'],
  ['deleted', '− deleted'],
  ['moved', '→ moved'],
  ['ghost', '⇠ moved away'],
  ['context', '· unchanged, at a changed import'],
  ['importer', '◦ unchanged, uses a changed export'],
]

/** A short line in an arrow's own stroke, for the legend. */
const arrowSample = (status: string) =>
  `<svg width="28" height="10" aria-hidden="true"><path class="edge ${status}" d="M1,5 H21"/><path class="head ${status}" d="M20,1 L27,5 L20,9 z"/></svg>`

const row = (heading: string, items: string) =>
  `<div class="lg-row"><span class="lg-h">${heading}</span><div class="lg-items">${items}</div></div>`

/** The files the map draws as boxes, ghosts left out. */
function boxPaths(map: ChangesetMap): Set<string> {
  const boxes = new Set<string>()
  const walk = (folder: Folder) => {
    for (const file of folder.files) if (file.status !== 'ghost') boxes.add(file.path)
    folder.folders.forEach(walk)
  }
  map.layers.forEach((layer) => walk(layer.root))
  return boxes
}

/** The legend's Show row: a checkbox per kind of arrow, or why there are no arrows. */
function showRow(map: ChangesetMap): string {
  if (map.imports.status !== 'ok') {
    return row(
      'Show',
      `<span>import arrows not available: ${esc(map.imports.reason)}</span>`,
    )
  }
  // Only imports between two boxes are drawn; the others are listed in the cards.
  const boxes = boxPaths(map)
  const drawn = map.imports.edges.filter((e) => boxes.has(e.to))
  const count = (status: string) => drawn.filter((e) => e.status === status).length
  const importers = new Set(
    map.imports.uses.filter((u) => boxes.has(u.from)).map((u) => u.from),
  ).size
  const box = (status: string, text: string, checked: boolean) =>
    `<label><input type="checkbox" id="show-${status}" data-show="${status}"${checked ? ' checked' : ''}>${arrowSample(status === 'importers' ? 'uses' : status)}${text}</label>`
  return row(
    'Show',
    [
      box('added', `added imports (${count('added')})`, true),
      box('removed', `removed imports (${count('removed')})`, true),
      box('importers', `unchanged importers (${importers})`, false),
    ].join(''),
  )
}

const MARKS = [
  '<span><b class="reach-sample">↗n</b>used by n unchanged files</span>',
  '<span><b class="api-sample">API +n −m</b>barrel exports added, removed</span>',
  `<span>${arrowSample('kept')}kept imports of the active box</span>`,
].join('')

/** The map data as JSON that cannot end the script block it sits in (`</script`, `<!--`). */
const embed = (map: ChangesetMap) => JSON.stringify(map).replace(/</g, '\\u003c')

/** The changeset map section: its heading, legend, data, canvas and script. */
export function renderMapSection(map: ChangesetMap): string {
  const offMap =
    map.offMap > 0
      ? ` ${map.offMap} file${map.offMap === 1 ? '' : 's'} left off the map (tests, CSS, type declarations).`
      : ''
  const boxes = SWATCHES.map(
    ([cls, text]) => `<span><i class="sw ${cls}"></i>${text}</span>`,
  ).join('')
  const legend = [
    row('Boxes', boxes),
    showRow(map),
    row('Marks', MARKS),
    `<p class="lg-note">Hover or focus a box for its card; click to pin it. Click a folder’s name to collapse or open it.${offMap}</p>`,
  ].join('')
  return [
    '<section id="changeset-map" aria-labelledby="changeset-map-title">',
    '<h2 id="changeset-map-title">Changeset map</h2>',
    `<style>${STYLE}</style>`,
    `<div class="legend">${legend}</div>`,
    `<script type="application/json" id="changeset-map-data">${embed(map)}</script>`,
    '<div class="scroll"><div class="map-canvas"><div id="map-card" class="map-card" hidden></div></div></div>',
    `<script>${CLIENT}</script>`,
    '</section>',
  ].join('\n')
}
