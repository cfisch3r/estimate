import { useEffect, useMemo, useRef, useState } from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { CaretDownIcon } from '@phosphor-icons/react/dist/csr/CaretDown'

interface MarkdownProps {
  content: string
  className?: string
}

// `description` is broadcast peer-to-peer and rendered in every participant's
// browser (see NetworkProvider), so the facilitator's raw markdown is
// effectively untrusted input by the time it reaches this component.
marked.setOptions({ breaks: true })

/** Renders facilitator-authored markdown (currently only `description`) as
 *  sanitized HTML. Used both in the participant view and in the facilitator's
 *  own preview toggle, so what the facilitator sees while authoring is exactly
 *  what participants receive.
 *
 *  `className` (e.g. `markdown-preview`, which caps the height and scrolls)
 *  goes on the outer, scrollable box; the inner div always carries the base
 *  `markdown` class that the typography rules in markdown.css target. Kept as
 *  two elements so a "there's more below" hint can sit alongside the content
 *  without being replaced by `dangerouslySetInnerHTML` on every render — a
 *  scrollbar alone doesn't say a box is scrollable, especially on macOS where
 *  scrollbars stay hidden until you touch them. */
export function Markdown({ content, className }: MarkdownProps) {
  const html = useMemo(() => {
    const parsed = marked.parse(content, { async: false })
    return DOMPurify.sanitize(parsed)
  }, [content])

  const boxRef = useRef<HTMLDivElement>(null)
  const [overflowing, setOverflowing] = useState(false)

  useEffect(() => {
    const box = boxRef.current
    if (!box) return
    const check = () => setOverflowing(box.scrollHeight > box.clientHeight + 1)
    check()
    // jsdom (tests) has no ResizeObserver — the one-off check above still
    // runs there, it just won't react to later layout changes.
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(check)
    observer.observe(box)
    return () => observer.disconnect()
  }, [html])

  return (
    <div ref={boxRef} className={['markdown-box', className].filter(Boolean).join(' ')}>
      <div className="markdown" dangerouslySetInnerHTML={{ __html: html }} />
      {overflowing && (
        <div className="markdown-overflow-hint" aria-hidden="true">
          <CaretDownIcon size={12} weight="bold" />
        </div>
      )}
    </div>
  )
}
