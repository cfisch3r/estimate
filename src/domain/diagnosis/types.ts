import type { LiveConnectionStatus, SessionRole } from '../types'

// What the connection diagnosis records (issue #229). Plain data, so an entry
// survives `localStorage` and `page.evaluate` unchanged. No entry ever holds an
// address, a name, an estimate value, an item title or a note.

/** An ICE candidate's type, as the `typ` token of its candidate line names it. */
export type CandidateType = 'host' | 'srflx' | 'prflx' | 'relay'

export type CandidateProtocol = 'udp' | 'tcp'

/** All the diagnosis keeps of a candidate: never its address or port. */
export interface CandidateKind {
  type: CandidateType
  protocol: CandidateProtocol
}

/** One fact about a live session, as recorded. Peer ids are already shortened. */
export type DiagnosticEvent =
  | { kind: 'session-start'; sessionCode: string; role: SessionRole }
  | { kind: 'status'; status: LiveConnectionStatus }
  | { kind: 'peer-join' | 'peer-leave'; peer: string }
  | { kind: 'join-error'; error: string; peer?: string }
  | {
      kind: 'rtc-candidates'
      /** Numbers the WebRTC attempts of one tab, in the order they began. */
      attempt: number
      side: 'local' | 'remote'
      candidates: CandidateKind[]
    }
  | {
      kind: 'rtc-state'
      attempt: number
      /** The browser's `RTCPeerConnectionState`, kept as text so the domain
       *  needs no DOM types. */
      connectionState: string
      /** The browser's `RTCIceConnectionState`, as text. */
      iceConnectionState: string
    }
  | { kind: 'rtc-selected'; attempt: number; local: CandidateKind; remote: CandidateKind }

/** A recorded event with when and where it happened. */
export type DiagnosticEntry = DiagnosticEvent & {
  /** ISO 8601 time of recording. */
  at: string
  /** A short random id of the browser tab that recorded it. */
  tab: string
}
