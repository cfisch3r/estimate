// The changeset map's script in the Review guide page. It reads the map data embedded in
// the page, lays out the layers, folders and file boxes, draws the import arrows between
// them, and lets the reader collapse and open folders, hover or pin a box to see its imports
// and details, and hide a kind of arrow. Inlined by changesetMap.ts; it runs in the browser
// and loads nothing.
;(() => {
  const section = document.getElementById('changeset-map')
  const dataBlock = document.getElementById('changeset-map-data')
  if (!section || !dataBlock) return
  const data = JSON.parse(dataBlock.textContent || '{}')
  const canvas = section.querySelector('.map-canvas')
  const card = document.getElementById('map-card')

  // Box, gap and frame sizes in px; the whole map is MAPW wide.
  const NW = 200
  const NH = 40
  const G = 12
  const FP = 10
  const FH = 26
  const PAD = 14
  const PADT = 44
  const MAPW = 1240
  const SIDEW = NW + 2 * PAD + 2 * FP
  const MAINW = MAPW - SIDEW - 24
  const STRIPW = 240
  const STRIP_ROW = 30
  // The hover card's max-width in changesetMap.css.
  const CARDW = 360

  /** Folder path → open, for folders the reader toggled. */
  const toggled = new Map()
  const isOpen = (f) =>
    !f.collapsible || (toggled.has(f.path) ? toggled.get(f.path) : !f.startsCollapsed)

  const baseName = (path) => path.slice(path.lastIndexOf('/') + 1)

  /** The units of a folder: file boxes, open folders (frames) and collapsed folders (boxes). */
  function unitsOf(folder) {
    return [
      ...folder.files.map((file) => ({ kind: 'file', file })),
      ...folder.folders.map((sub) =>
        isOpen(sub)
          ? { kind: 'folder', folder: sub, items: unitsOf(sub) }
          : { kind: 'collapsed', folder: sub },
      ),
    ]
  }

  function measure(items, maxW) {
    let x = 0
    let y = 0
    let lineH = 0
    let w = 0
    for (const it of items) {
      const [iw, ih] = it.kind === 'folder' ? measureFolder(it, maxW) : [NW, NH]
      if (x > 0 && x + iw > maxW) {
        x = 0
        y += lineH + G
        lineH = 0
      }
      it.rx = x
      it.ry = y
      x += iw + G
      lineH = Math.max(lineH, ih)
      w = Math.max(w, x - G)
    }
    return { w, h: items.length ? y + lineH : 0 }
  }

  function measureFolder(f, maxW) {
    const inner = measure(f.items, maxW - 2 * FP)
    f.w = Math.min(maxW, Math.max(inner.w + 2 * FP, f.folder.label.length * 7 + 60))
    f.h = FH + inner.h + FP
    return [f.w, f.h]
  }

  function place(items, ox, oy, out) {
    for (const it of items) {
      const x = ox + it.rx
      const y = oy + it.ry
      if (it.kind === 'folder') {
        out.frames.push({ kind: 'folder', x, y, w: it.w, h: it.h, folder: it.folder })
        place(it.items, x + FP, y + FH, out)
      } else {
        out.boxes.push({ unit: it, x, y })
      }
    }
  }

  function layout() {
    const out = { frames: [], boxes: [], height: 0 }
    const main = data.layers.filter((l) => !l.side)
    const side = data.layers.find((l) => l.side)
    let y = 0
    let groupTop = null
    main.forEach((layer, i) => {
      const inGroup = layer.group !== undefined
      if (inGroup && groupTop === null) {
        groupTop = y
        y += 34
      }
      const inset = inGroup ? 16 : 0
      const items = unitsOf(layer.root)
      const w = MAINW - 2 * inset
      const r = measure(items, w - 2 * PAD)
      place(items, inset + PAD, y + PADT, out)
      const h = items.length ? PADT + r.h + PAD : 34
      out.frames.push({ kind: 'layer', x: inset, y, w, h, layer, empty: !items.length })
      y += h + (inGroup ? 10 : 18)
      const next = main[i + 1]
      if (inGroup && (!next || next.group !== layer.group)) {
        out.frames.unshift({
          kind: 'group',
          x: 0,
          y: groupTop,
          w: MAINW,
          h: y - groupTop,
          group: layer.group,
        })
        groupTop = null
        y += 16
      }
    })
    if (side) {
      const items = unitsOf(side.root)
      const r = measure(items, SIDEW - 2 * PAD)
      place(items, MAINW + 24 + PAD, PADT, out)
      const h = Math.max(y - 18, PADT + r.h + PAD)
      out.frames.push({
        kind: 'layer',
        x: MAINW + 24,
        y: 0,
        w: SIDEW,
        h,
        layer: side,
        empty: !items.length,
      })
      y = Math.max(y, h + 18)
    }
    out.height = y
    return out
  }

  function counts(folder) {
    const c = {}
    const walk = (f) => {
      for (const file of f.files)
        if (file.status !== 'context') c[file.status] = (c[file.status] || 0) + 1
      f.folders.forEach(walk)
    }
    walk(folder)
    return c
  }

  const SIGN = {
    added: '+',
    changed: '~',
    deleted: '−',
    moved: '→',
    ghost: '⇠',
    context: '·',
  }
  /** What a count chip says to a screen reader after its sign and number. */
  const WORD = {
    added: 'added',
    changed: 'changed',
    deleted: 'deleted',
    moved: 'moved in',
    ghost: 'moved away',
    context: 'unchanged',
  }

  /** The status sign before a file name, so the status does not rest on colour alone. */
  function sign(status) {
    const e = el('span', 'sign', SIGN[status])
    e.setAttribute('aria-hidden', 'true')
    return e
  }

  /** A mark only sighted readers need, such as the ▾ and ▸ of a folder. */
  function hidden(text) {
    const e = el('span', '', text)
    e.setAttribute('aria-hidden', 'true')
    return e
  }

  function el(tag, className, text) {
    const e = document.createElement(tag)
    if (className) e.className = className
    if (text !== undefined) e.textContent = text
    return e
  }

  function at(e, x, y, w, h) {
    e.style.left = `${x}px`
    e.style.top = `${y}px`
    if (w !== undefined) e.style.width = `${w}px`
    if (h !== undefined) e.style.height = `${h}px`
    return e
  }

  // Re-rendering replaces every element, so focus moves to the folder's name again.
  function toggle(folder) {
    const opening = !isOpen(folder)
    toggled.set(folder.path, opening)
    render()
    const target = [...canvas.querySelectorAll('button.folder-label')].find(
      (e) => e.dataset.path === folder.path,
    )
    target?.focus()
  }

  function describe(file) {
    if (file.status === 'moved') return `moved from ${file.from}`
    if (file.status === 'ghost') return `moved to ${file.movedTo}`
    if (file.status === 'context')
      return 'unchanged; an import of it was added or removed'
    return file.status
  }

  // Import arrows. The active box is the one the pointer is on, else the one with keyboard
  // focus, else the one pinned with a click; it shows all of its own imports and fades the
  // other arrows.
  const imports = data.imports?.status === 'ok' ? data.imports.edges : []
  const show = { added: true, removed: true }
  let hovered = null
  let focused = null
  let pinned = null
  const active = () => hovered ?? focused ?? pinned
  /** Box key (a file path, or a collapsed folder's path) → where it is drawn and its card. */
  let boxes = new Map()
  let svg = null
  const SVGNS = 'http://www.w3.org/2000/svg'
  const IMPORT_SIGN = { added: '+', removed: '−', kept: '·' }
  const short = (path) => path.replace(/^src\//, '')

  /** The box a file is drawn in: its own, or the collapsed folder that holds it. */
  function boxOf(path) {
    if (boxes.has(path)) return path
    let found = null
    for (const key of boxes.keys())
      if (path.startsWith(`${key}/`) && (!found || key.length > found.length)) found = key
    return found
  }

  /** One arrow per two boxes and kind; imports joined in a collapsed folder are counted. */
  function arrows() {
    const joined = new Map()
    for (const edge of imports) {
      const from = boxOf(edge.from)
      const to = boxOf(edge.to)
      if (!from || !to || from === to) continue
      const key = `${from}\0${to}\0${edge.status}`
      if (!joined.has(key)) joined.set(key, { from, to, status: edge.status, count: 0 })
      joined.get(key).count++
    }
    return [...joined.values()]
  }

  /** A curve from the side of one box that faces the other to that side of the other. */
  function route(a, b) {
    const ac = { x: a.x + NW / 2, y: a.y + NH / 2 }
    const bc = { x: b.x + NW / 2, y: b.y + NH / 2 }
    let p1, p2, d1, d2
    if (Math.abs(bc.y - ac.y) > NH) {
      const s = Math.sign(bc.y - ac.y)
      // The ends spread along the side, so arrows into one box don't meet in one point.
      const off = Math.max(-NW / 2 + 16, Math.min(NW / 2 - 16, (bc.x - ac.x) * 0.25))
      p1 = { x: ac.x + off, y: ac.y + (s * NH) / 2 }
      p2 = { x: bc.x - off, y: bc.y - (s * NH) / 2 }
      d1 = { x: 0, y: s }
      d2 = { x: 0, y: -s }
    } else {
      const s = Math.sign(bc.x - ac.x) || 1
      p1 = { x: ac.x + (s * NW) / 2, y: ac.y }
      p2 = { x: bc.x - (s * NW) / 2, y: bc.y }
      d1 = { x: s, y: 0 }
      d2 = { x: -s, y: 0 }
    }
    const k = Math.max(30, Math.hypot(p2.x - p1.x, p2.y - p1.y) / 3)
    const c1 = { x: p1.x + d1.x * k, y: p1.y + d1.y * k }
    const c2 = { x: p2.x + d2.x * k, y: p2.y + d2.y * k }
    const mid = {
      x: (p1.x + 3 * c1.x + 3 * c2.x + p2.x) / 8,
      y: (p1.y + 3 * c1.y + 3 * c2.y + p2.y) / 8,
    }
    return { d: `M${p1.x},${p1.y} C${c1.x},${c1.y} ${c2.x},${c2.y} ${p2.x},${p2.y}`, mid }
  }

  function svgEl(tag, attrs) {
    const e = document.createElementNS(SVGNS, tag)
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v))
    return e
  }

  function arrowLayer(height) {
    const layer = svgEl('svg', {
      class: 'edges drawn',
      width: MAPW,
      height,
      'aria-hidden': 'true',
    })
    const defs = svgEl('defs', {})
    for (const status of Object.keys(IMPORT_SIGN)) {
      const marker = svgEl('marker', {
        id: `arrow-${status}`,
        viewBox: '0 0 10 10',
        refX: 9.5,
        refY: 5,
        markerWidth: 9,
        markerHeight: 9,
        markerUnits: 'userSpaceOnUse',
        orient: 'auto',
      })
      marker.append(svgEl('path', { d: 'M0,0 L10,5 L0,10 z', class: `head ${status}` }))
      defs.append(marker)
    }
    layer.append(defs)
    return layer
  }

  function drawArrows() {
    if (!svg) return
    svg.querySelectorAll('.edge, .edge-count').forEach((e) => e.remove())
    const focus = active()
    const faded = []
    const lit = []
    for (const a of arrows()) {
      const own = focus !== null && a.from === focus
      if (!(a.status === 'kept' ? own : show[a.status] || own)) continue
      const dim = focus !== null && !own ? ' dim' : ''
      const { d, mid } = route(boxes.get(a.from), boxes.get(a.to))
      const parts = [
        svgEl('path', {
          d,
          class: `edge ${a.status}${dim}`,
          'marker-end': `url(#arrow-${a.status})`,
        }),
      ]
      if (a.count > 1) {
        const badge = svgEl('g', { class: `edge-count ${a.status}${dim}` })
        badge.append(svgEl('circle', { cx: mid.x, cy: mid.y, r: 8 }))
        const t = svgEl('text', { x: mid.x, y: mid.y + 3.5, 'text-anchor': 'middle' })
        t.textContent = String(a.count)
        badge.append(t)
        parts.push(badge)
      }
      ;(dim ? faded : lit).push(...parts)
    }
    // The focused box's arrows lie on top of the faded ones.
    svg.append(...faded, ...lit)
  }

  function importRow(edge, collapsed) {
    const row = el('div', `imp ${edge.status}`)
    const mark = el('span', 'imp-sign', IMPORT_SIGN[edge.status])
    mark.setAttribute('aria-hidden', 'true')
    const text = el('div', 'imp-text')
    const target = `${collapsed ? `${baseName(edge.from)} → ` : ''}${short(edge.to)}`
    text.append(el('code', '', target))
    if (!boxOf(edge.to)) text.append(el('span', 'off', ' · not on the map'))
    text.append(el('div', 'names', edge.names.join(', ')))
    row.append(mark, text)
    return row
  }

  function cardLines(key) {
    const box = boxes.get(key)
    const lines = [el('code', '', box.path), el('div', '', box.status)]
    const own = imports.filter((e) => boxOf(e.from) === key)
    for (const [status, title] of [
      ['added', 'Imports added'],
      ['removed', 'Imports removed'],
      ['kept', 'Imports kept'],
    ]) {
      const list = own.filter((e) => e.status === status)
      if (!list.length) continue
      lines.push(el('div', 'card-h', `${title} (${list.length})`))
      for (const edge of list) lines.push(importRow(edge, box.collapsed))
    }
    if (pinned === key)
      lines.push(el('div', 'card-pin', 'Pinned: click the box again or press Esc'))
    return lines
  }

  function showCard(key) {
    const box = boxes.get(key)
    card.replaceChildren(...cardLines(key))
    card.hidden = false
    // Below the box, or above it when it would run past the bottom of the map.
    const below = box.y + NH + 8
    const height = card.offsetHeight
    const mapH = parseFloat(canvas.style.height) || 0
    const y = below + height > mapH && box.y - height - 8 > 0 ? box.y - height - 8 : below
    at(card, Math.min(Math.max(4, box.x), MAPW - CARDW), y)
  }

  function refresh() {
    const focus = active()
    if (focus !== null && boxes.has(focus)) showCard(focus)
    else card.hidden = true
    // The card describes the box it is shown for, so a screen reader hears the imports too.
    const shown = card.hidden ? null : focus
    for (const node of canvas.querySelectorAll('.node[data-key]')) {
      node.setAttribute('aria-pressed', String(node.dataset.key === pinned))
      if (node.dataset.key === shown) node.setAttribute('aria-describedby', 'map-card')
      else node.removeAttribute('aria-describedby')
    }
    drawArrows()
  }

  function pin(key) {
    pinned = pinned === key ? null : key
    refresh()
  }

  /** Pointer and keyboard focus each make a box active on their own. */
  function hover(e, key) {
    e.addEventListener('mouseenter', () => {
      hovered = key
      refresh()
    })
    e.addEventListener('mouseleave', () => {
      if (hovered === key) hovered = null
      refresh()
    })
    e.addEventListener('focus', () => {
      focused = key
      refresh()
    })
    e.addEventListener('blur', () => {
      if (focused === key) focused = null
      refresh()
    })
  }

  // Escape closes the card, whether hover, focus or a pin opened it; it does nothing while
  // no card is open.
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || active() === null) return
    hovered = null
    focused = null
    pinned = null
    refresh()
  })
  for (const box of section.querySelectorAll('input[data-show]')) {
    box.addEventListener('change', () => {
      show[box.dataset.show] = box.checked
      drawArrows()
    })
  }

  function render() {
    const L = layout()
    // The element the card describes is about to go, and a removed element sends no
    // mouseleave or blur.
    card.hidden = true
    canvas.querySelectorAll('.drawn').forEach((e) => e.remove())
    boxes = new Map()
    hovered = null
    focused = null
    const add = (e) => {
      e.classList.add('drawn')
      canvas.appendChild(e)
      return e
    }

    for (const f of L.frames) {
      if (f.kind === 'group') {
        add(at(el('div', 'group-frame'), f.x, f.y, f.w, f.h))
        add(at(el('div', 'layer-label', f.group.toUpperCase()), f.x + 16, f.y + 10))
      } else if (f.kind === 'layer') {
        add(
          at(
            el(
              'div',
              `layer-frame${f.layer.side ? ' side' : ''}${f.empty ? ' empty' : ''}`,
            ),
            f.x,
            f.y,
            f.w,
            f.h,
          ),
        )
        const name = el('div', 'layer-label')
        name.append(
          el('b', '', f.layer.name),
          el('span', '', f.empty ? ' · nothing changed' : ''),
        )
        add(at(name, f.x + 14, f.y + (f.empty ? 9 : 10)))
      } else {
        add(at(el('div', 'folder-frame'), f.x, f.y, f.w, f.h))
        // A folder that can be collapsed names itself with a disclosure button; one that
        // holds a single file only has a name.
        const name = el(
          f.folder.collapsible ? 'button' : 'span',
          'folder-label',
          `${f.folder.label}/`,
        )
        if (f.folder.collapsible) {
          name.type = 'button'
          name.setAttribute('aria-label', `${f.folder.path}/`)
          name.setAttribute('aria-expanded', 'true')
          name.append(hidden(' ▾'))
          name.addEventListener('click', () => toggle(f.folder))
          name.dataset.path = f.folder.path
        }
        add(at(name, f.x + 8, f.y + 5))
      }
    }

    // Arrows run under the boxes, from the edge of one to the edge of the other.
    svg = add(arrowLayer(L.height))
    for (const { unit, x, y } of L.boxes) {
      // Every box is a toggle button that pins it.
      const box = at(el('button', 'node'), x, y, NW, NH)
      box.type = 'button'
      if (unit.kind === 'file') {
        const file = unit.file
        box.classList.add(file.status)
        box.dataset.key = file.path
        box.append(sign(file.status), el('span', 'name', baseName(file.path)))
        box.title = file.path
        box.setAttribute('aria-label', `${file.path}, ${describe(file)}`)
        boxes.set(file.path, { x, y, path: file.path, status: describe(file) })
        box.addEventListener('click', () => pin(file.path))
        hover(box, file.path)
      } else {
        const folder = unit.folder
        const c = counts(folder)
        box.classList.add('collapsed')
        box.dataset.key = folder.path
        const chips = el('div', 'chips')
        const words = []
        for (const status of Object.keys(SIGN)) {
          if (!c[status]) continue
          const chip = el('span', `chip ${status}`, `${SIGN[status]}${c[status]}`)
          chip.append(el('span', 'sr', ` ${WORD[status]}`))
          chips.append(chip)
          words.push(`${c[status]} ${WORD[status]}`)
        }
        box.append(chips)
        box.setAttribute('aria-label', `${folder.path}/, collapsed, ${words.join(', ')}`)
        const status = `${folder.changed} changed file${folder.changed === 1 ? '' : 's'}, collapsed`
        boxes.set(folder.path, { x, y, path: `${folder.path}/`, status, collapsed: true })
        box.addEventListener('click', () => pin(folder.path))
        hover(box, folder.path)
        // The folder's name opens it; it lies on the box as a button of its own.
        const name = el('button', 'folder-label collapsed-name', `${folder.label}/`)
        name.type = 'button'
        name.dataset.path = folder.path
        name.setAttribute('aria-label', `${folder.path}/`)
        name.setAttribute('aria-expanded', 'false')
        name.append(hidden(' ▸'))
        name.addEventListener('click', () => toggle(folder))
        // The name lies on the box, so the pointer or focus on it still means the box.
        hover(name, folder.path)
        add(box)
        add(at(name, x + 6, y + 4))
        continue
      }
      add(box)
    }

    let height = L.height
    if (data.strips.length) {
      const top = L.height + 8
      let bottom = top
      data.strips.forEach((strip, i) => {
        const x = i * (STRIPW + G)
        add(at(el('div', 'strip-title', `${strip.name} (${strip.files.length})`), x, top))
        strip.files.forEach((file, j) => {
          // The file name stays whole; a long folder path is shortened instead.
          const cut = file.path.lastIndexOf('/') + 1
          const row = el('div', `strip-file ${file.status}`)
          row.append(
            sign(file.status),
            el('span', 'dir', file.path.slice(0, cut)),
            el('span', 'name', file.path.slice(cut)),
          )
          at(row, x, top + 26 + j * STRIP_ROW, STRIPW, 24)
          row.title = `${file.path} · ${describe(file)}`
          add(row)
        })
        bottom = Math.max(bottom, top + 26 + strip.files.length * STRIP_ROW)
      })
      height = bottom + 8
    }
    canvas.style.width = `${MAPW}px`
    canvas.style.height = `${height}px`
    if (pinned !== null && !boxes.has(pinned)) pinned = null
    refresh()
  }

  render()
})()
