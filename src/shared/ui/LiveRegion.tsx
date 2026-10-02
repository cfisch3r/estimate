import type { ReactNode } from 'react'

interface LiveRegionProps {
  /** `status` is announced politely once the user is idle; `alert` interrupts. */
  role?: 'status' | 'alert'
  children?: ReactNode
}

/** A container whose content changes are announced by screen readers. Use
 *  `status` for progress and information, `alert` only for a failure the person
 *  needs to act on. Render it
 *  persistently and swap only its children: a live region that mounts already
 *  holding text is announced inconsistently, so conditionally rendering the
 *  region itself would defeat it. `display: contents` keeps the empty container
 *  out of the surrounding layout (no extra gap while nothing is shown). */
export function LiveRegion({ role = 'status', children }: LiveRegionProps) {
  return (
    <div role={role} style={{ display: 'contents' }}>
      {children}
    </div>
  )
}
