import {
  createEstimate,
  isEstimationUnit,
  type Estimate,
  type EstimationUnit,
  type RawEstimateInput,
} from '../calc'

/** The subset of an item a participant needs to render the read-only detail —
 *  broadcast by the facilitator so participants never hold the full item list. */
export interface SnapshotItem {
  id: string
  title: string
  description: string
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

export interface SessionSnapshot {
  currentItem: SnapshotItem | null
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

/** A participant's estimate plus the item it belongs to. The item id keeps a
 *  straggler (or peer-join re-broadcast) submission for a just-finalized item
 *  from being recorded against whatever item became active next. */
export interface EstimateMessage {
  itemId: string
  /** The round this submission was made for. A missing value (older build, or a
   *  bare pre-#8 estimate) bypasses the facilitator's round check rather than
   *  being treated as a mismatch — see `unwrapEstimateMessage`. */
  round?: number
  estimate: Estimate
}

/** A client announcing which display name belongs to its `participantId`, so
 *  peers can label reveal rows with real names instead of "Teammate N". Kept off
 *  the pure `Estimate` wire type — names never enter `calc`. */
export interface ParticipantAnnounce {
  participantId: string
  name: string
}

type Unsubscribe = () => void

interface MessageAction<T> {
  send: (data: T, options?: { target?: string }) => void
  onMessage: ((data: unknown, context: { peerId: string }) => void) | null
}

interface RequestAction<TReq, TRes> {
  request: (data: TReq, options: { target: string; timeoutMs?: number }) => Promise<TRes>
  onRequest: ((data: TReq, context: { peerId: string }) => TRes | Promise<TRes>) | null
}

/** The minimal slice of Trystero's Room this module needs, so tests can supply
 *  a fake room without implementing Room's full media/streaming surface.
 *  Overloaded like Trystero's real `makeAction`: a `{ kind: 'request' }`
 *  config yields a request/response action instead of a one-way message one. */
export interface ActionRoom {
  makeAction<T>(name: string): MessageAction<T>
  makeAction<TReq, TRes>(
    name: string,
    config: { kind: 'request' },
  ): RequestAction<TReq, TRes>
}

export interface TypedActions {
  /** `target` sends only to the facilitator's peerId rather than broadcasting
   *  to the mesh — this is what keeps a participant's estimate off every other
   *  peer's wire (ADR-003, "Single owner"). */
  sendEstimate(itemId: string, estimate: Estimate, round: number, target?: string): void
  sendSyncState(snapshot: SessionSnapshot): void
  sendAnnounce(announce: ParticipantAnnounce): void
  /** A peer that just (re)connected pulls the facilitator's current snapshot
   *  itself, rather than waiting on the facilitator's peer-join handler to
   *  push one (ADR-003, "Snapshot delivery: pull on arrival"). */
  requestSnapshot(targetPeerId: string): Promise<SessionSnapshot>
  onEstimate(
    cb: (
      itemId: string,
      estimate: Estimate,
      peerId: string,
      round: number | undefined,
    ) => void,
  ): Unsubscribe
  onSyncState(cb: (snapshot: SessionSnapshot, peerId: string) => void): Unsubscribe
  onAnnounce(cb: (announce: ParticipantAnnounce, peerId: string) => void): Unsubscribe
  /** Facilitator-only: answers a peer's `requestSnapshot` pull. */
  onRequestSnapshot(cb: () => SessionSnapshot): Unsubscribe
}

function createSubscribable<T extends unknown[]>() {
  const listeners = new Set<(...args: T) => void>()
  return {
    subscribe(cb: (...args: T) => void): Unsubscribe {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    notify(...args: T) {
      for (const listener of listeners) listener(...args)
    },
  }
}

/** createEstimate() assumes a well-shaped RawEstimateInput (its existing callers all
 *  build one from form fields) and throws on null/missing fields rather than
 *  returning a Result. Peer messages are untrusted, so this boundary must not let
 *  that throw escape — it's caught and treated the same as a validation failure. */
function safeCreateEstimate(input: unknown): ReturnType<typeof createEstimate> {
  try {
    return createEstimate(input as RawEstimateInput)
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/** Every submission is validated through createEstimate() before being kept —
 *  this is the "M5 must call createEstimate() on every incoming peer message"
 *  boundary check from the architecture doc, applied to snapshot payloads too. */
function sanitizeSubmissions(submissions: unknown): RawEstimateInput[] {
  if (!Array.isArray(submissions)) return []
  const sanitized: RawEstimateInput[] = []
  for (const submission of submissions) {
    const result = safeCreateEstimate(submission)
    if (result.ok) {
      sanitized.push(result.value)
    } else {
      console.warn('Dropping malformed estimate in incoming snapshot:', result.error)
    }
  }
  return sanitized
}

function isValidRosterEntry(value: unknown): value is RosterEntry {
  if (typeof value !== 'object' || value === null) return false
  const entry = value as Record<string, unknown>
  return (
    typeof entry.participantId === 'string' &&
    entry.participantId.length > 0 &&
    typeof entry.submitted === 'boolean' &&
    typeof entry.connected === 'boolean'
  )
}

/** Same tolerance as `sanitizeSubmissions`: an older/newer build's malformed
 *  or missing roster shouldn't drop the whole snapshot — just that entry. */
function sanitizeRoster(roster: unknown): RosterEntry[] {
  if (!Array.isArray(roster)) return []
  return roster.filter(isValidRosterEntry)
}

function isValidSnapshotItem(value: unknown): value is SnapshotItem {
  if (typeof value !== 'object' || value === null) return false
  const item = value as Record<string, unknown>
  return (
    typeof item.id === 'string' &&
    typeof item.title === 'string' &&
    typeof item.description === 'string'
  )
}

/** A generous upper bound on a display name — long enough for any real name,
 *  short enough that a hostile peer can't bloat every client's store / reveal
 *  list with a multi-megabyte string. Inbound names are truncated to this. */
export const MAX_ANNOUNCE_NAME_LENGTH = 80

function isValidAnnounce(data: unknown): data is ParticipantAnnounce {
  if (typeof data !== 'object' || data === null) return false
  const announce = data as Record<string, unknown>
  return (
    typeof announce.participantId === 'string' &&
    // Match createEstimate()'s participantId check, so an announce can only ever
    // key an entry that a real submission could also key.
    announce.participantId.trim().length > 0 &&
    typeof announce.name === 'string' &&
    announce.name.trim().length > 0
  )
}

function isValidSnapshotShape(data: unknown): data is SessionSnapshot {
  if (typeof data !== 'object' || data === null) return false
  const snapshot = data as Record<string, unknown>
  return (
    (snapshot.currentItem === null || isValidSnapshotItem(snapshot.currentItem)) &&
    Array.isArray(snapshot.finalizedItemIds) &&
    snapshot.finalizedItemIds.every((id) => typeof id === 'string')
  )
}

/** The inbound estimate message: `{ itemId, estimate }`. The estimate itself is
 *  re-validated separately through `safeCreateEstimate`; this only checks the
 *  envelope. */
function hasEstimateEnvelope(
  data: unknown,
): data is { itemId: string; estimate: unknown; round?: unknown } {
  if (typeof data !== 'object' || data === null) return false
  const message = data as Record<string, unknown>
  return typeof message.itemId === 'string' && message.itemId.length > 0
}

/** An older build (issue #7, already on `main`) sends the bare `Estimate` with no
 *  `{ itemId }` envelope. Same mid-deploy tolerance the `syncState` handler gives
 *  `unit` / `revealed`: unwrap it and surface an empty `itemId`, which the store
 *  treats as "the current round" — the pre-#8 behaviour. A missing/non-number
 *  `round` surfaces as `undefined`, which the facilitator's round check treats
 *  as "no round to compare" rather than a mismatch. */
function unwrapEstimateMessage(data: unknown): {
  itemId: string
  payload: unknown
  round: number | undefined
} {
  return hasEstimateEnvelope(data)
    ? {
        itemId: data.itemId,
        payload: data.estimate,
        round: typeof data.round === 'number' ? data.round : undefined,
      }
    : { itemId: '', payload: data, round: undefined }
}

export function createTypedActions(room: ActionRoom): TypedActions {
  const submitEstimateAction = room.makeAction<EstimateMessage>('submitEstimate')
  const syncStateAction = room.makeAction<SessionSnapshot>('syncState')
  const announceAction = room.makeAction<ParticipantAnnounce>('announce')
  const requestSnapshotAction = room.makeAction<null, SessionSnapshot>(
    'requestSnapshot',
    { kind: 'request' },
  )

  const estimateSubscribable =
    createSubscribable<[string, Estimate, string, number | undefined]>()
  const syncStateSubscribable = createSubscribable<[SessionSnapshot, string]>()
  const announceSubscribable = createSubscribable<[ParticipantAnnounce, string]>()

  submitEstimateAction.onMessage = (data, { peerId }) => {
    const { itemId, payload, round } = unwrapEstimateMessage(data)
    const result = safeCreateEstimate(payload)
    if (result.ok) {
      estimateSubscribable.notify(itemId, result.value, peerId, round)
    } else {
      console.warn('Dropping malformed incoming estimate:', result.error)
    }
  }

  syncStateAction.onMessage = (data, { peerId }) => {
    if (!isValidSnapshotShape(data)) {
      console.warn('Dropping malformed incoming snapshot')
      return
    }
    syncStateSubscribable.notify(
      {
        currentItem: data.currentItem,
        // Tolerate a missing/unknown unit (e.g. a facilitator on an older build
        // mid-deploy) rather than dropping the whole snapshot — fall back to the
        // store default so the participant still gets the round.
        unit: isEstimationUnit(data.unit) ? data.unit : 'days',
        // Same tolerance for `revealed` (older builds omit it): default to false.
        revealed: data.revealed === true,
        // Same tolerance for `round` (older builds omit it): default to 0.
        round: typeof data.round === 'number' ? data.round : 0,
        roster: sanitizeRoster(data.roster),
        submissions: sanitizeSubmissions(data.submissions),
        finalizedItemIds: data.finalizedItemIds,
      },
      peerId,
    )
  }

  announceAction.onMessage = (data, { peerId }) => {
    if (!isValidAnnounce(data)) {
      console.warn('Dropping malformed incoming announce payload')
      return
    }
    announceSubscribable.notify(
      {
        participantId: data.participantId,
        name: data.name.trim().slice(0, MAX_ANNOUNCE_NAME_LENGTH),
      },
      peerId,
    )
  }

  return {
    sendEstimate: (itemId, estimate, round, target) =>
      target
        ? submitEstimateAction.send({ itemId, estimate, round }, { target })
        : submitEstimateAction.send({ itemId, estimate, round }),
    sendSyncState: (snapshot) => syncStateAction.send(snapshot),
    sendAnnounce: (announce) => announceAction.send(announce),
    requestSnapshot: (targetPeerId) =>
      requestSnapshotAction.request(null, { target: targetPeerId, timeoutMs: 2000 }),
    onEstimate: estimateSubscribable.subscribe,
    onSyncState: syncStateSubscribable.subscribe,
    onAnnounce: announceSubscribable.subscribe,
    onRequestSnapshot: (cb) => {
      requestSnapshotAction.onRequest = () => cb()
      return () => {
        requestSnapshotAction.onRequest = null
      }
    },
  }
}
