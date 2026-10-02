import { useEffect, useRef } from 'react'

/** Moves focus to the panel's heading when `key` changes. The view switches
 *  (estimating -> waiting -> revealed, or a new item) unmount whatever had focus,
 *  which would otherwise drop it to <body> with no cue that anything changed.
 *  Skips the first render, so arriving on the screen doesn't steal focus. */
export function useFocusHeadingOnChange(key: string) {
  const containerRef = useRef<HTMLDivElement>(null)
  const previousKey = useRef(key)

  useEffect(() => {
    if (previousKey.current === key) return
    previousKey.current = key
    const heading = containerRef.current?.querySelector<HTMLElement>('h1')
    if (!heading) return
    // Headings aren't focusable by default; -1 allows programmatic focus only, so
    // panels don't each have to opt in.
    heading.tabIndex = -1
    heading.focus()
  }, [key])

  return containerRef
}
