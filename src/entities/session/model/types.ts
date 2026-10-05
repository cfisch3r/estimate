import type {
  AggregateResult,
  Estimate,
  EstimateValues,
  EstimationUnit,
  RawEstimateInput,
} from '../../estimate/@x/session'

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
  mySubmission: EstimateValues | null
}

/** A values-free roster row for the current round (ADR-003, "Single owner").
 *  One structure, two renderings: the facilitator's participant panel and the
 *  participant's "N of M submitted" line both read this instead of raw
 *  submission values, which never reach a participant before reveal. */
export interface RosterEntry {
  participantId: string
  submitted: boolean
  connected: boolean
}

/** The subset of an item a participant needs to render the read-only detail —
 *  broadcast by the facilitator so participants never hold the full item list. */
export interface SnapshotItem {
  id: string
  title: string
  description: string
}

/** The facilitator's authoritative round state, as broadcast to (or pulled by)
 *  participants (ADR-003). Built by `buildSessionSnapshot`, applied by
 *  `applySyncState`; the wire layer (`api/actions.ts`) only carries it. */
export interface SessionSnapshot {
  currentItem: SnapshotItem | null
  /** The facilitator's session name, so a participant's kicker can show "Sprint 42
   *  estimates (7F QK 2M)" instead of the join code alone. Tolerated as missing
   *  (defaults to '') the same way `unit`/`revealed` are, for an older peer. */
  sessionName: string
  /** The unit the facilitator is estimating in, so participant forms and bars
   *  label values with the session's unit rather than their local default. */
  unit: EstimationUnit
  /** Whether the facilitator has revealed the current round. Lets a peer that
   *  joins or reconnects mid-reveal land straight on the revealed view instead
   *  of a dead estimate form. */
  revealed: boolean
  /** The active item's round number, bumped by Retry. Lets a participant that
   *  reconnects after missing both a Reveal and a Retry tell the rounds apart
   *  from the snapshot alone (ADR-003, "Versioned rounds"). */
  round: number
  /** Who's in and who has submitted this round, with no estimate values.
   *  Drives a participant's "N of M submitted" line and the facilitator's
   *  panel alike. */
  roster: RosterEntry[]
  /** The frozen submission set, populated only once `revealed` is true —
   *  pre-reveal this stays empty, since values must not reach participants
   *  before the reveal (ADR-003). */
  submissions: RawEstimateInput[]
  finalizedItemIds: string[]
}

export type SessionMode = 'manual' | 'live'

export type SessionRole = 'facilitator' | 'participant'

/** The transport's view of the link to the session. */
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected'

/** The network layer's ConnectionStatus, plus 'idle' for "not in a live session". */
export type LiveConnectionStatus = ConnectionStatus | 'idle'
