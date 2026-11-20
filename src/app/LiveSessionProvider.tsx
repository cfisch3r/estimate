import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { createJoinSession } from '../adapters/network/session'
import {
  createLiveSessionController,
  LiveSessionContext,
  type DiagnosticsLog,
  type LiveSessionController,
} from '../application/composition'

/** Composition point for the live session: wires the Trystero adapter, recording
 *  into `diagnostics`, into the application's live-session controller, provides
 *  its `LiveSessionApi` to the tree, and leaves the room when the app unmounts. */
export function LiveSessionProvider({
  diagnostics,
  children,
}: {
  diagnostics: DiagnosticsLog
  children: ReactNode
}) {
  const controllerRef = useRef<LiveSessionController | null>(null)
  if (controllerRef.current === null) {
    controllerRef.current = createLiveSessionController({
      joinSession: createJoinSession({ diagnostics }),
      diagnostics,
    })
  }
  const controller = controllerRef.current

  useEffect(() => controller.dispose, [controller])

  return (
    <LiveSessionContext.Provider value={controller.api}>
      {children}
    </LiveSessionContext.Provider>
  )
}
