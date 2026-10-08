import { useSessionStore } from '../stores'

/** Start a single-user (manual-entry) session. Navigation is the caller's. */
export function useStartSingleUserSession(): () => void {
  return useSessionStore((s) => s.selectFirstPending)
}
