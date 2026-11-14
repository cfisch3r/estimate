/** Where focus should land after the load flow swaps what is on screen: the
 *  control that had focus (the Load row, or Discard) unmounts in the same
 *  render that mounts its replacement, so the replacement takes focus on
 *  mount — but only when the swap came from that action, never on a plain
 *  page visit. Module state: there is one mode-selection screen at a time. */
type Target = 'loaded-session' | 'load-row'

let pending: Target | null = null

export function handFocusTo(target: Target): void {
  pending = target
}

/** True once for the target the last action handed focus to. */
export function takeFocus(target: Target): boolean {
  if (pending !== target) return false
  pending = null
  return true
}
