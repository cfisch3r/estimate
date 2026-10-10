// Test seeding only: the full stores, so a test can `setState` any field. The lint
// rule limits importing this to test files; production code uses the barrel (UI) or
// `./stores` (use cases, `LiveSessionProvider`).
export { useSessionStore, useConnectionStore, useRoundStore } from './stores'

import { useConnectionStore } from './stores'

/** Back to a disconnected, session-less connection store. */
export function resetConnectionStore(): void {
  useConnectionStore.getState().leaveLiveSession()
}
