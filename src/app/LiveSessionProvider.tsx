import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { joinSession } from '../adapters/network/session'
import {
  createLiveSessionController,
  LiveSessionContext,
  type LiveSessionController,
} from '../application/composition'

/** Composition point for the live session: wires the Trystero adapter into the
 *  application's live-session controller, provides its `LiveSessionApi` to the
 *  tree, and leaves the room when the app unmounts. */
export function LiveSessionProvider({ children }: { children: ReactNode }) {
  const controllerRef = useRef<LiveSessionController | null>(null)
  if (controllerRef.current === null) {
    controllerRef.current = createLiveSessionController({ joinSession })
  }
  const controller = controllerRef.current

  useEffect(() => controller.dispose, [controller])

  return (
    <LiveSessionContext.Provider value={controller.api}>
      {children}
    </LiveSessionContext.Provider>
  )
}
