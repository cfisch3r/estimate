import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ChangesetMap } from './reviewMap.ts'

// The changeset map section of the Review guide. The map data goes into the page as a JSON
// block; a small script (changesetMap.client.js, inlined) lays it out in the browser, so a
// reader can collapse and open folders. Nothing is loaded from outside the page.

const CLIENT = readFileSync(join(import.meta.dirname, 'changesetMap.client.js'), 'utf8')

// Frames only draw: pointer-events:none lets clicks reach the folder names under them.
// Status colours for both themes, next to the guide's own tokens.
const DARK = `--add-bg:#12261e;--add:#3fb950;--del-bg:#2d1214;--del:#ff7b72;--chg-bg:#2e1f0e;--chg:#f0883e;--mov-bg:#231a33;--mov:#bc8cff;--frame:#6e7681;--focus:#58a6ff;`
const STYLE = `
:root{--add-bg:#dafbe1;--add:#1a7f37;--del-bg:#ffebe9;--del:#cf222e;--chg-bg:#fff1e5;--chg:#bc4c00;--mov-bg:#fbefff;--mov:#8250df;--frame:#8c959f;--focus:#0969da}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){${DARK}}}
:root[data-theme="dark"]{${DARK}}
#changeset-map{position:relative;left:50%;transform:translateX(-50%);width:min(1274px,calc(100vw - 32px))}
#changeset-map .legend{display:flex;flex-wrap:wrap;gap:6px 16px;font-size:.82rem;color:var(--muted);margin:0 0 10px}
#changeset-map .sw{display:inline-block;width:14px;height:11px;border-radius:3px;border:1.5px solid var(--frame);vertical-align:-1px;margin-right:4px}
#changeset-map .scroll{overflow-x:auto;border:1px solid var(--line);border-radius:10px;padding:16px}
#changeset-map .map-canvas{position:relative}
#changeset-map .group-frame{position:absolute;pointer-events:none;box-sizing:border-box;border:1.5px solid var(--frame);border-radius:16px}
#changeset-map .layer-frame{position:absolute;pointer-events:none;box-sizing:border-box;border:1.5px solid var(--fg);border-radius:14px;opacity:.7}
#changeset-map .layer-frame.empty{background:var(--card);opacity:.4}
#changeset-map .folder-frame{position:absolute;pointer-events:none;box-sizing:border-box;border:1px dashed var(--frame);border-radius:10px}
#changeset-map .layer-label{position:absolute;font-size:12px;line-height:1.25}
#changeset-map .layer-label span{color:var(--muted)}
#changeset-map .folder-label{position:absolute;font:600 10.5px/1 ui-monospace,monospace;color:var(--muted);background:none;border:0;padding:2px;cursor:pointer;white-space:nowrap}
#changeset-map .folder-label:disabled{cursor:default}
#changeset-map .folder-label:not(:disabled):hover{color:var(--fg)}
#changeset-map .node{position:absolute;box-sizing:border-box;border:1.5px solid var(--frame);border-radius:10px;padding:5px 8px;font:600 10.5px/1.25 ui-monospace,monospace;background:var(--bg);overflow:hidden;white-space:nowrap;text-overflow:ellipsis;cursor:default}
#changeset-map .node.collapsed{border-width:2px;cursor:pointer;white-space:normal}
#changeset-map .chips{display:flex;gap:4px;margin-top:3px}
#changeset-map .chip{font:600 10px/1 ui-monospace,monospace;padding:2px 4px;border-radius:4px;border:1px solid}
#changeset-map .added,#changeset-map .chip.added{background:var(--add-bg);border-color:var(--add)}
#changeset-map .changed,#changeset-map .chip.changed{background:var(--chg-bg);border-color:var(--chg)}
#changeset-map .deleted,#changeset-map .chip.deleted{background:var(--del-bg);border-color:var(--del)}
#changeset-map .node.deleted{text-decoration:line-through}
#changeset-map .moved,#changeset-map .chip.moved{background:var(--mov-bg);border-color:var(--mov)}
#changeset-map .ghost,#changeset-map .chip.ghost{background:transparent;border-color:var(--mov);border-style:dashed;color:var(--muted)}
#changeset-map .strip-title{position:absolute;font-size:12px;font-weight:650}
#changeset-map .strip-file{position:absolute;box-sizing:border-box;border:1.5px solid var(--frame);border-radius:7px;padding:3px 7px;font:10.5px/1.3 ui-monospace,monospace;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
#changeset-map .map-card{position:absolute;z-index:5;max-width:320px;background:var(--bg);border:1px solid var(--frame);border-radius:8px;padding:8px 10px;font-size:12px;line-height:1.4;box-shadow:0 6px 20px rgba(0,0,0,.18);pointer-events:none;overflow-wrap:anywhere}
#changeset-map .node:focus-visible,#changeset-map .folder-label:focus-visible{outline:2px solid var(--focus);outline-offset:2px}
`

const SWATCHES: Array<[string, string]> = [
  ['added', 'added'],
  ['changed', 'changed'],
  ['deleted', 'deleted'],
  ['moved', 'moved'],
  ['ghost', 'old place of a moved file'],
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
    '<h2>Changeset map</h2>',
    '<section id="changeset-map" aria-label="Changeset map">',
    `<style>${STYLE}</style>`,
    `<p class="legend">${legend}<span>dashed frame: folder, click its name to collapse</span>${offMap}</p>`,
    `<script type="application/json" id="changeset-map-data">${embed(map)}</script>`,
    '<div class="scroll"><div class="map-canvas"><div id="map-card" class="map-card" hidden></div></div></div>',
    `<script>${CLIENT}</script>`,
    '</section>',
  ].join('\n')
}
