import { useSessionStore } from '../stores'

/** Drop a loaded session before any mode has started, back to a new one. */
export function useDiscardSession(): () => void {
  return useSessionStore((s) => s.resetSession)
}
