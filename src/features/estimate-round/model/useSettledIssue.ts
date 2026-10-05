import { useEffect, useState } from 'react'
import type { EstimateIssue } from '../lib/describeEstimateIssue'

/** How long an entry must stay invalid, unchanged, before a problem is first shown. */
export const ISSUE_SETTLE_MS = 600

/** Holds a *new* problem back until the entry has settled, so a transient state on
 *  the way to a valid value — typing "15" after a best case of 5 passes through
 *  "1" — doesn't flash a banner (and a screen-reader announcement) on and off.
 *
 *  Only the step from "no problem" to "a problem" is delayed. Once a problem is
 *  showing, it updates in place as the entry changes, and it clears the moment the
 *  entry is valid, so a stale or blinking error never lingers. `flush` shows the
 *  current problem immediately (e.g. when a field loses focus), and an entry that
 *  is already invalid when the form opens is shown from the start. */
export function useSettledIssue(issue: EstimateIssue | null) {
  const present = issue !== null
  const key = issue ? `${issue.headline}|${issue.message}` : null
  const [showing, setShowing] = useState(present)

  useEffect(() => {
    if (!present) {
      setShowing(false)
      return
    }
    if (showing) return
    // Restarts whenever the problem changes, so it must hold still to be shown.
    const timer = setTimeout(() => setShowing(true), ISSUE_SETTLE_MS)
    return () => clearTimeout(timer)
  }, [present, key, showing])

  return {
    issue: present && showing ? issue : null,
    flush: () => setShowing(present),
  }
}
