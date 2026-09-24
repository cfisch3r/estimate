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
 *  Three nested elements, not one: an outer `markdown-wrap` (just a
 *  positioning context), the scrollable `markdown-box` (`className` — e.g.
 *  `markdown-preview` — styles this one), and the inner `markdown` div with
 *  the actual HTML. The "there's more below" hint has to live in the outer
 *  wrap, *not* inside the scrolling box: an absolutely positioned element
 *  scrolls right along with its scrolling containing block, so putting it
 *  inside `markdown-box` made it drift up through the content as the box
 *  scrolled instead of staying pinned to the visible bottom edge. */
export function Markdown({ content, className }: MarkdownProps) {
  const html = useMemo(() => {
    const parsed = marked.parse(content, { async: false })
    return DOMPurify.sanitize(parsed)
  }, [content])

  const boxRef = useRef<HTMLDivElement>(null)
  const [showHint, setShowHint] = useState(false)

  useEffect(() => {
    const box = boxRef.current
    if (!box) return

    // Only a cue for content still hidden below the fold — once scrolled to
    // the bottom there's nothing left to hint at.
    const update = () => {
      const atBottom = box.scrollTop + box.clientHeight >= box.scrollHeight - 1
      setShowHint(box.scrollHeight > box.clientHeight + 1 && !atBottom)
    }
    update()
    box.addEventListener('scroll', update)

    // jsdom (tests) has no ResizeObserver — the listener above still catches
    // scrolling there, it just won't react to later layout-only changes.
    if (typeof ResizeObserver === 'undefined') {
      return () => box.removeEventListener('scroll', update)
    }
    const observer = new ResizeObserver(update)
    observer.observe(box)
    return () => {
      box.removeEventListener('scroll', update)
      observer.disconnect()
    }
  }, [html])

  return (
    <div className="markdown-wrap">
      <div ref={boxRef} className={['markdown-box', className].filter(Boolean).join(' ')}>
        <div className="markdown" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
      {showHint && (
        <div className="markdown-overflow-hint" aria-hidden="true">
          <CaretDownIcon size={12} weight="bold" />
        </div>
      )}
    </div>
  )
}
