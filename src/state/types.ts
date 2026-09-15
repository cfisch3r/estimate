import type { AggregateResult, Estimate } from '../calc'
import type { ConnectionStatus } from '../network/connection'
import type { RosterEntry } from '../network/actions'

export interface Item {
  id: string
  title: string
  description: string
  notes: string
  finalResult: AggregateResult | null
  /** Live mode (facilitator side): participant submissions received for the
   *  current round on this item, keyed by participantId (last write wins).
   *  Always empty in single-user mode and after a Retry. */
  submissions: Estimate[]
  /** Live mode (facilitator side): whether this round's estimates have been
   *  revealed — Workspace state 1d. Reset to false by Retry. */
  revealed: boolean
  /** Live mode: this item's round number, bumped by Retry. Lets a participant
   *  that reconnects after missing both a Reveal and the following Retry tell
   *  the new round apart from the old one, which a `revealed` transition alone
   *  can't do (ADR-003, "Versioned rounds"). */
  round: number
}

/** What a participant client knows about the round the facilitator is running —
 *  populated from the facilitator's broadcast syncState / estimate / reveal
 *  messages. Facilitator clients don't use this; they hold the full `items` list. */
export interface LiveRound {
  item: { id: string; title: string; description: string }
  /** The frozen submission set, populated only once `revealed` is true — see
   *  `SessionSnapshot.submissions`. Empty pre-reveal; use `roster` instead to
   *  render who has submitted. */
  submissions: Estimate[]
  revealed: boolean
  /** The facilitator's round number for this item, mirrored from the snapshot. */
  round: number
  /** Who's in and who has submitted this round, with no estimate values
   *  (ADR-003, "Single owner"). Drives the "N of M submitted" line. */
  roster: RosterEntry[]
  /** This participant's own most recent submitted values, or null before submitting. */
  mySubmission: { best: number; likely: number; worst: number } | null
}

export type ScreenId =
  'mode-select' | 'workspace' | 'summary' | 'history' | 'join' | 'estimate'

export type SessionMode = 'manual' | 'live'

export type SessionRole = 'facilitator' | 'participant'

/** The network layer's ConnectionStatus, plus 'idle' for "not in a live session". */
export type LiveConnectionStatus = ConnectionStatus | 'idle'
