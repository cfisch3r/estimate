import { createContext, useContext } from 'react'

/** Where focus should land after the load flow swaps what is on screen: the
 *  control that had focus (the Load row, or Discard) unmounts in the same
 *  render that mounts its replacement, so the replacement takes focus on
 *  mount — but only when the swap came from that action, never on a plain
 *  page visit. Held by the screen that renders both, so it lives and dies
 *  with that screen. */
export type Target = 'loaded-session' | 'load-row'

export type FocusHandoff = {
  /** The next mounted `target` takes focus. */
  handFocusTo: (target: Target) => void
  /** True once for the target the last action handed focus to. */
  takeFocus: (target: Target) => boolean
}

export const FocusHandoffContext = createContext<FocusHandoff | null>(null)

export function useFocusHandoff(): FocusHandoff {
  const handoff = useContext(FocusHandoffContext)
  if (handoff === null) {
    throw new Error('useFocusHandoff must be used within a SessionFileFocusScope')
  }
  return handoff
}
