import { useEffect, useState } from 'react'
import type { EstimateIssue } from './describeEstimateIssue'

/** How long an entry must stay invalid, unchanged, before the problem is shown. */
export const ISSUE_SETTLE_MS = 600

/** Holds a new problem back until the entry has settled, so a transient state on
 *  the way to a valid value — typing "15" after a best case of 5 passes through
 *  "1" — doesn't flash a banner (and a screen-reader announcement) on and off.
 *
 *  Asymmetric on purpose: a problem that is resolved clears at once, so a stale
 *  error never lingers. `flush` shows the current problem immediately (e.g. when a
 *  field loses focus), and an entry that is already invalid when the form opens is
 *  shown from the start. */
export function useSettledIssue(issue: EstimateIssue | null) {
  const key = issue ? `${issue.headline}|${issue.message}` : null
  const [settledKey, setSettledKey] = useState(key)

  useEffect(() => {
    if (key === null) {
      setSettledKey(null)
      return
    }
    const timer = setTimeout(() => setSettledKey(key), ISSUE_SETTLE_MS)
    return () => clearTimeout(timer)
  }, [key])

  return {
    issue: key !== null && key === settledKey ? issue : null,
    flush: () => setSettledKey(key),
  }
}
