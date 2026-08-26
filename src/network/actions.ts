import { createEstimate, type Estimate, type RawEstimateInput } from '../calc'

export interface SessionSnapshot {
  currentItemId: string | null
  submissions: RawEstimateInput[]
  finalizedItemIds: string[]
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
  onEstimate(cb: (estimate: Estimate, peerId: string) => void): Unsubscribe
  onSyncState(cb: (snapshot: SessionSnapshot, peerId: string) => void): Unsubscribe
  onReveal(cb: (itemId: string, peerId: string) => void): Unsubscribe
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

function isValidSnapshotShape(data: unknown): data is SessionSnapshot {
  if (typeof data !== 'object' || data === null) return false
  const snapshot = data as Record<string, unknown>
  return (
    (typeof snapshot.currentItemId === 'string' || snapshot.currentItemId === null) &&
    Array.isArray(snapshot.finalizedItemIds) &&
    snapshot.finalizedItemIds.every((id) => typeof id === 'string')
  )
}

export function createTypedActions(room: ActionRoom): TypedActions {
  const submitEstimateAction = room.makeAction<Estimate>('submitEstimate')
  const syncStateAction = room.makeAction<SessionSnapshot>('syncState')
  const revealAction = room.makeAction<string>('reveal')

  const estimateSubscribable = createSubscribable<[Estimate, string]>()
  const syncStateSubscribable = createSubscribable<[SessionSnapshot, string]>()
  const revealSubscribable = createSubscribable<[string, string]>()

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
        currentItemId: data.currentItemId,
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

  return {
    sendEstimate: (estimate) => submitEstimateAction.send(estimate),
    sendSyncState: (snapshot) => syncStateAction.send(snapshot),
    sendReveal: (itemId) => revealAction.send(itemId),
    onEstimate: estimateSubscribable.subscribe,
    onSyncState: syncStateSubscribable.subscribe,
    onReveal: revealSubscribable.subscribe,
  }
}
