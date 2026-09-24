const BULLET_LINE = /^(\s*)([-*+])(\s+)(.*)$/
const LIST_INDENT = '  '

function currentLine(value: string, pos: number): { start: number; text: string } {
  const start = value.lastIndexOf('\n', pos - 1) + 1
  const nextNewline = value.indexOf('\n', pos)
  const end = nextNewline === -1 ? value.length : nextNewline
  return { start, text: value.slice(start, end) }
}

// Writes the edit straight to the DOM (value + selection) rather than
// deferring the cursor move to a requestAnimationFrame: Enter/Tab can be
// typed in rapid succession, and a deferred callback risks landing after
// the *next* keystroke has already fired, garbling the cursor position.
// Setting textarea.value here first means React's controlled-input
// re-render (triggered by the caller's onChange) is a no-op on the DOM —
// value already matches — so it leaves this synchronous selection alone.
function applyEdit(textarea: HTMLTextAreaElement, next: string, cursor: number): string {
  textarea.value = next
  textarea.setSelectionRange(cursor, cursor)
  return next
}

/** Enter on a bullet-list line continues the list: a non-empty item gets a
 *  new item below it with the same indent/bullet, an empty item (pressing
 *  Enter a second time) drops its bullet and opens a blank line instead of
 *  adding another one, so the list has a way to end. The blank line matters
 *  — CommonMark treats an unindented line directly below a list item (no
 *  blank line between them) as a "lazy continuation" of that item's
 *  paragraph, so text typed right after would otherwise get silently
 *  swallowed into the list instead of starting its own paragraph. Returns
 *  null on any other line — the caller should let the browser's default
 *  Enter behavior happen. */
export function continueListOnEnter(textarea: HTMLTextAreaElement, value: string): string | null {
  const pos = textarea.selectionStart ?? value.length
  const line = currentLine(value, pos)
  const match = BULLET_LINE.exec(line.text)
  if (!match) return null

  const [, indent, bullet, , content] = match

  if (content!.trim() === '') {
    const next = value.slice(0, line.start) + '\n' + value.slice(pos)
    return applyEdit(textarea, next, line.start + 1)
  }

  const prefix = `${indent}${bullet} `
  const next = value.slice(0, pos) + '\n' + prefix + value.slice(pos)
  return applyEdit(textarea, next, pos + 1 + prefix.length)
}

/** Tab/Shift+Tab indents/outdents the current line by one nesting level
 *  (two spaces, what `marked` expects for a nested list) — but only when the
 *  cursor is already on a bullet-list line. Any other line returns null so
 *  the caller lets Tab do its normal job of moving focus to the next
 *  control, rather than trapping keyboard navigation everywhere. */
export function indentListLine(
  textarea: HTMLTextAreaElement,
  value: string,
  outdent: boolean,
): string | null {
  const pos = textarea.selectionStart ?? value.length
  const line = currentLine(value, pos)
  if (!BULLET_LINE.test(line.text)) return null

  if (!outdent) {
    const next = value.slice(0, line.start) + LIST_INDENT + value.slice(line.start)
    return applyEdit(textarea, next, pos + LIST_INDENT.length)
  }

  const leadingSpaces = /^ */.exec(line.text)![0].length
  const removeCount = Math.min(LIST_INDENT.length, leadingSpaces)
  const next = value.slice(0, line.start) + value.slice(line.start + removeCount)
  return applyEdit(textarea, next, Math.max(line.start, pos - removeCount))
}
