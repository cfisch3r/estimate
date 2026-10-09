// Composition-time entry point: what `src/app` needs to wire the live session, and
// nothing the feature, page or widget layers should touch. The lint rule allows
// importing this file from `src/app` only; UI code uses the layer barrel (`./index`).
export {
  createLiveSessionController,
  type LiveSessionController,
} from './useCases/liveSessionController'
export {
  NetworkSessionContext,
  type NetworkSessionApi,
} from './ports/networkSessionContext'
export type { ConnectionState, JoinSession } from './ports/outbound/networkTransport'
