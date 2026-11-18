import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ChangesetMap } from './reviewMap.ts'

// The changeset map section of the Review guide. The map data goes into the page as a JSON
// block; a small script (changesetMap.client.js, inlined) lays it out in the browser, so a
// reader can collapse and open folders. Nothing is loaded from outside the page.

const CLIENT = readFileSync(join(import.meta.dirname, 'changesetMap.client.js'), 'utf8')

const STYLE = readFileSync(join(import.meta.dirname, 'changesetMap.css'), 'utf8')

// The same signs as the file boxes, so the legend does not rest on colour alone.
const SWATCHES: Array<[string, string]> = [
  ['added', '+ added'],
  ['changed', '~ changed'],
  ['deleted', '− deleted'],
  ['moved', '→ moved'],
  ['ghost', '⇠ old place of a moved file'],
]

/** The map data as JSON that cannot end the script block it sits in (`</script`, `<!--`). */
const embed = (map: ChangesetMap) => JSON.stringify(map).replace(/</g, '\\u003c')

/** The changeset map section: its heading, legend, data, canvas and script. */
export function renderMapSection(map: ChangesetMap): string {
  const offMap =
    map.offMap > 0
      ? `<span>${map.offMap} file${map.offMap === 1 ? '' : 's'} left off the map (tests, CSS, type declarations)</span>`
      : ''
  const legend = SWATCHES.map(
    ([cls, text]) => `<span><i class="sw ${cls}"></i>${text}</span>`,
  ).join('')
  return [
    '<section id="changeset-map" aria-labelledby="changeset-map-title">',
    '<h2 id="changeset-map-title">Changeset map</h2>',
    `<style>${STYLE}</style>`,
    `<p class="legend">${legend}<span>dashed frame: folder, click its name to collapse</span>${offMap}</p>`,
    `<script type="application/json" id="changeset-map-data">${embed(map)}</script>`,
    '<div class="scroll"><div class="map-canvas"><div id="map-card" class="map-card" hidden></div></div></div>',
    `<script>${CLIENT}</script>`,
    '</section>',
  ].join('\n')
}
