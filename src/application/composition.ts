// Composition-time entry point: what `src/app` needs to wire the live session, and
// nothing the feature, page or widget layers should touch. The lint rule allows
// importing this file from `src/app` only; UI code uses the layer barrel (`./index`).
export {
  createLiveSessionController,
  type LiveSessionController,
} from './useCases/liveSessionController'
export { LiveSessionContext, type LiveSessionApi } from './useCases/liveSessionContext'
export { useLiveSession } from './useCases/useLiveSession'
export { ParticipantIdentityContext } from './ports/participantIdentityContext'
export type { ParticipantIdentityApi } from './ports/outbound/participantIdentity'
export { FileDownloadContext } from './ports/fileDownloadContext'
export type { FileDownloadApi } from './ports/outbound/fileDownload'
export type { ConnectionState, JoinSession } from './ports/outbound/networkTransport'
export type { DiagnosticsLog } from './ports/outbound/diagnosticsLog'
export { DiagnosticsLogContext } from './ports/diagnosticsLogContext'
export { ClipboardContext } from './ports/clipboardContext'
