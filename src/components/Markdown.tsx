import { useMemo } from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

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
 *  what participants receive. */
export function Markdown({ content, className }: MarkdownProps) {
  const html = useMemo(() => {
    const parsed = marked.parse(content, { async: false })
    return DOMPurify.sanitize(parsed)
  }, [content])

  return (
    <div
      className={['markdown', className].filter(Boolean).join(' ')}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
