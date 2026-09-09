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

export interface SessionSnapshot {
  currentItem: SnapshotItem | null
  /** The unit the facilitator is estimating in, so participant forms and bars
   *  label values with the session's unit rather than their local default. */
  unit: EstimationUnit
  submissions: RawEstimateInput[]
  finalizedItemIds: string[]
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
  send: (data: T) => void
  onMessage: ((data: unknown, context: { peerId: string }) => void) | null
}

/** The minimal slice of Trystero's Room this module needs, so tests can supply
 *  a fake room without implementing Room's full media/streaming surface. */
export interface ActionRoom {
  makeAction: <T>(name: string) => MessageAction<T>
}

export interface TypedActions {
  sendEstimate(estimate: Estimate): void
  sendSyncState(snapshot: SessionSnapshot): void
  sendReveal(itemId: string): void
  sendAnnounce(announce: ParticipantAnnounce): void
  onEstimate(cb: (estimate: Estimate, peerId: string) => void): Unsubscribe
  onSyncState(cb: (snapshot: SessionSnapshot, peerId: string) => void): Unsubscribe
  onReveal(cb: (itemId: string, peerId: string) => void): Unsubscribe
  onAnnounce(cb: (announce: ParticipantAnnounce, peerId: string) => void): Unsubscribe
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

function isValidSnapshotItem(value: unknown): value is SnapshotItem {
  if (typeof value !== 'object' || value === null) return false
  const item = value as Record<string, unknown>
  return (
    typeof item.id === 'string' &&
    typeof item.title === 'string' &&
    typeof item.description === 'string'
  )
}

function isValidAnnounce(data: unknown): data is ParticipantAnnounce {
  if (typeof data !== 'object' || data === null) return false
  const announce = data as Record<string, unknown>
  return (
    typeof announce.participantId === 'string' &&
    announce.participantId.length > 0 &&
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

export function createTypedActions(room: ActionRoom): TypedActions {
  const submitEstimateAction = room.makeAction<Estimate>('submitEstimate')
  const syncStateAction = room.makeAction<SessionSnapshot>('syncState')
  const revealAction = room.makeAction<string>('reveal')
  const announceAction = room.makeAction<ParticipantAnnounce>('announce')

  const estimateSubscribable = createSubscribable<[Estimate, string]>()
  const syncStateSubscribable = createSubscribable<[SessionSnapshot, string]>()
  const revealSubscribable = createSubscribable<[string, string]>()
  const announceSubscribable = createSubscribable<[ParticipantAnnounce, string]>()

  submitEstimateAction.onMessage = (data, { peerId }) => {
    const result = safeCreateEstimate(data)
    if (result.ok) {
      estimateSubscribable.notify(result.value, peerId)
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
        submissions: sanitizeSubmissions(data.submissions),
        finalizedItemIds: data.finalizedItemIds,
      },
      peerId,
    )
  }

  revealAction.onMessage = (data, { peerId }) => {
    if (typeof data !== 'string') {
      console.warn('Dropping malformed incoming reveal payload')
      return
    }
    revealSubscribable.notify(data, peerId)
  }

  announceAction.onMessage = (data, { peerId }) => {
    if (!isValidAnnounce(data)) {
      console.warn('Dropping malformed incoming announce payload')
      return
    }
    announceSubscribable.notify(
      { participantId: data.participantId, name: data.name.trim() },
      peerId,
    )
  }

  return {
    sendEstimate: (estimate) => submitEstimateAction.send(estimate),
    sendSyncState: (snapshot) => syncStateAction.send(snapshot),
    sendReveal: (itemId) => revealAction.send(itemId),
    sendAnnounce: (announce) => announceAction.send(announce),
    onEstimate: estimateSubscribable.subscribe,
    onSyncState: syncStateSubscribable.subscribe,
    onReveal: revealSubscribable.subscribe,
    onAnnounce: announceSubscribable.subscribe,
  }
}
