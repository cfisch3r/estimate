// The changeset map's script in the Review guide page. It reads the map data embedded in
// the page, lays out the layers, folders and file boxes, and lets the reader collapse and
// open folders and see a file's details on hover. Inlined by changesetMap.ts; it runs in
// the browser and loads nothing.
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
      for (const file of f.files) c[file.status] = (c[file.status] || 0) + 1
      f.folders.forEach(walk)
    }
    walk(folder)
    return c
  }

  const SIGN = { added: '+', changed: '~', deleted: '−', moved: '→', ghost: '⇠' }

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

  // Re-rendering replaces every element, so focus moves to what now stands for the folder:
  // its name after opening, its box after collapsing.
  function toggle(folder) {
    const opening = !isOpen(folder)
    toggled.set(folder.path, opening)
    render()
    const target = [
      ...canvas.querySelectorAll(opening ? '.folder-label' : '.node.collapsed'),
    ].find((e) => e.dataset.path === folder.path)
    target?.focus()
  }

  function describe(file) {
    if (file.status === 'moved') return `moved from ${file.from}`
    if (file.status === 'ghost') return `moved to ${file.movedTo}`
    return file.status
  }

  function showCard(lines, x, y) {
    card.replaceChildren(
      ...lines.map((line, i) => el(i === 0 ? 'code' : 'div', '', line)),
    )
    at(card, Math.max(4, x), y)
    card.hidden = false
  }

  function hover(e, lines, x, y) {
    const show = () => showCard(lines, x, y)
    const hide = () => {
      card.hidden = true
    }
    e.addEventListener('mouseenter', show)
    e.addEventListener('focus', show)
    e.addEventListener('mouseleave', hide)
    e.addEventListener('blur', hide)
  }

  function activate(e, action) {
    e.addEventListener('click', action)
    e.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault()
        action()
      }
    })
  }

  function render() {
    const L = layout()
    canvas.querySelectorAll('.drawn').forEach((e) => e.remove())
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
        const can = f.folder.collapsible
        const button = el(
          'button',
          'folder-label',
          `${f.folder.label}/${can ? ' ▾' : ''}`,
        )
        button.type = 'button'
        if (can) {
          button.setAttribute('aria-label', `Collapse folder ${f.folder.label}`)
          button.addEventListener('click', () => toggle(f.folder))
          button.dataset.path = f.folder.path
        } else {
          button.disabled = true
        }
        add(at(button, f.x + 8, f.y + 5))
      }
    }

    for (const { unit, x, y } of L.boxes) {
      const box = at(el('div', 'node'), x, y, NW, NH)
      box.tabIndex = 0
      if (unit.kind === 'file') {
        const file = unit.file
        box.classList.add(file.status)
        box.textContent = baseName(file.path)
        box.title = file.path
        box.setAttribute('aria-label', `${file.path}, ${describe(file)}`)
        hover(box, [file.path, describe(file)], x, y + NH + 8)
      } else {
        const folder = unit.folder
        const c = counts(folder)
        box.classList.add('collapsed')
        box.dataset.path = folder.path
        box.setAttribute('role', 'button')
        box.setAttribute('aria-label', `Folder ${folder.label}, collapsed, open it`)
        box.append(el('div', 'collapsed-label', `${folder.label}/ ▸`))
        const chips = el('div', 'chips')
        for (const status of Object.keys(SIGN)) {
          if (c[status])
            chips.append(el('span', `chip ${status}`, `${SIGN[status]}${c[status]}`))
        }
        box.append(chips)
        activate(box, () => toggle(folder))
        hover(
          box,
          [
            folder.path,
            `${folder.changed} changed file${folder.changed === 1 ? '' : 's'}`,
          ],
          x,
          y + NH + 8,
        )
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
  }

  render()
})()
