import { useState } from 'react'
import type { ReactNode } from 'react'
import { FocusHandoffContext } from '../model/focusHandoff'
import type { FocusHandoff, Target } from '../model/focusHandoff'

/** Wraps the screen that shows the Load row and the loaded-session card. */
export function SessionFileFocusScope({ children }: { children: ReactNode }) {
  const [handoff] = useState<FocusHandoff>(() => {
    let pending: Target | null = null
    return {
      handFocusTo: (target) => {
        pending = target
      },
      takeFocus: (target) => {
        if (pending !== target) return false
        pending = null
        return true
      },
    }
  })
  return (
    <FocusHandoffContext.Provider value={handoff}>
      {children}
    </FocusHandoffContext.Provider>
  )
}
