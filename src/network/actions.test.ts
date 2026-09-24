import { describe, expect, it, vi } from 'vitest'
import { createTypedActions, MAX_ANNOUNCE_NAME_LENGTH, type ActionRoom } from './actions'
import { createEstimate } from '../calc'

function makeFakeAction() {
  return {
    send: vi.fn(),
    onMessage: null as ((data: unknown, ctx: { peerId: string }) => void) | null,
  }
}

function makeFakeRequestAction() {
  return {
    request: vi.fn(),
    onRequest: null as ((data: unknown, ctx: { peerId: string }) => unknown) | null,
  }
}

function makeFakeRoom() {
  const actionsByName: Record<string, ReturnType<typeof makeFakeAction>> = {}
  const requestActionsByName: Record<
    string,
    ReturnType<typeof makeFakeRequestAction>
  > = {}
  const room: ActionRoom = {
    makeAction: vi.fn((name: string, config?: { kind: 'request' }) => {
      if (config?.kind === 'request') {
        requestActionsByName[name] = makeFakeRequestAction()
        return requestActionsByName[name] as never
      }
      actionsByName[name] = makeFakeAction()
      return actionsByName[name] as never
    }) as ActionRoom['makeAction'],
  }
  return { room, actionsByName, requestActionsByName }
}

const validEstimate = createEstimate({ participantId: 'a', best: 1, likely: 2, worst: 3 })
if (!validEstimate.ok) throw new Error('test fixture invalid')

describe('createTypedActions', () => {
  it('requests delivery of an estimate (with its item id) targeted at the given peer', async () => {
    const { room, requestActionsByName } = makeFakeRoom()
    const actions = createTypedActions(room)
    requestActionsByName.submitEstimate!.request.mockResolvedValue({ ok: true })

    await actions.sendEstimate('item-1', validEstimate.value, 2, 'facilitator-peer')

    expect(requestActionsByName.submitEstimate!.request).toHaveBeenCalledWith(
      { itemId: 'item-1', estimate: validEstimate.value, round: 2 },
      { target: 'facilitator-peer', timeoutMs: 800 },
    )
  })

  it('rejects with the underlying request error when delivery fails', async () => {
    const { room, requestActionsByName } = makeFakeRoom()
    const actions = createTypedActions(room)
    const error = Object.assign(new Error('timed out'), { kind: 'timeout' })
    requestActionsByName.submitEstimate!.request.mockRejectedValue(error)

    await expect(
      actions.sendEstimate('item-1', validEstimate.value, 2, 'facilitator-peer'),
    ).rejects.toBe(error)
  })

  it('forwards a valid incoming estimate, with its item id and round, to subscribers and acks it', () => {
    const { room, requestActionsByName } = makeFakeRoom()
    const actions = createTypedActions(room)
    const cb = vi.fn()
    actions.onEstimate(cb)

    const ack = requestActionsByName.submitEstimate!.onRequest?.(
      {
        itemId: 'item-1',
        round: 2,
        estimate: { participantId: 'b', best: 1, likely: 2, worst: 3 },
      },
      { peerId: 'peer-1' },
    )

    expect(cb).toHaveBeenCalledWith(
      'item-1',
      { participantId: 'b', best: 1, likely: 2, worst: 3 },
      'peer-1',
      2,
    )
    expect(ack).toEqual({ ok: true })
  })

  it('forwards an incoming estimate with round undefined when the envelope omits it', () => {
    const { room, requestActionsByName } = makeFakeRoom()
    const actions = createTypedActions(room)
    const cb = vi.fn()
    actions.onEstimate(cb)

    requestActionsByName.submitEstimate!.onRequest?.(
      {
        itemId: 'item-1',
        estimate: { participantId: 'b', best: 1, likely: 2, worst: 3 },
      },
      { peerId: 'peer-1' },
    )

    expect(cb).toHaveBeenCalledWith(
      'item-1',
      { participantId: 'b', best: 1, likely: 2, worst: 3 },
      'peer-1',
      undefined,
    )
  })

  it('accepts a bare estimate with no envelope (pre-#8 build) under an empty item id', () => {
    const { room, requestActionsByName } = makeFakeRoom()
    const actions = createTypedActions(room)
    const cb = vi.fn()
    actions.onEstimate(cb)

    requestActionsByName.submitEstimate!.onRequest?.(
      { participantId: 'b', best: 1, likely: 2, worst: 3 },
      { peerId: 'peer-1' },
    )

    expect(cb).toHaveBeenCalledWith(
      '',
      { participantId: 'b', best: 1, likely: 2, worst: 3 },
      'peer-1',
      undefined,
    )
  })

  it('throws (surfacing a failure to the sender) on a malformed incoming estimate instead of forwarding it', () => {
    const { room, requestActionsByName } = makeFakeRoom()
    const actions = createTypedActions(room)
    const cb = vi.fn()
    actions.onEstimate(cb)

    expect(() =>
      requestActionsByName.submitEstimate!.onRequest?.(
        {
          itemId: 'item-1',
          estimate: { participantId: 'b', best: 9, likely: 2, worst: 3 },
        },
        { peerId: 'peer-1' },
      ),
    ).toThrow()
    expect(cb).not.toHaveBeenCalled()
  })

  it('throws on a completely malformed incoming estimate (missing fields)', () => {
    const { room, requestActionsByName } = makeFakeRoom()
    const actions = createTypedActions(room)
    const cb = vi.fn()
    actions.onEstimate(cb)

    expect(() =>
      requestActionsByName.submitEstimate!.onRequest?.({}, { peerId: 'peer-1' }),
    ).toThrow()
    expect(() =>
      requestActionsByName.submitEstimate!.onRequest?.(
        { itemId: 'x' },
        { peerId: 'peer-1' },
      ),
    ).toThrow()
    expect(cb).not.toHaveBeenCalled()
  })

  it('throws on a null incoming estimate', () => {
    const { room, requestActionsByName } = makeFakeRoom()
    const actions = createTypedActions(room)
    const cb = vi.fn()
    actions.onEstimate(cb)

    expect(() =>
      requestActionsByName.submitEstimate!.onRequest?.(null, { peerId: 'peer-1' }),
    ).toThrow()
    expect(cb).not.toHaveBeenCalled()
  })

  const item = { id: 'item-1', title: 'Retry queue', description: 'exponential backoff' }

  it('sends a snapshot through the syncState action', () => {
    const { room, actionsByName } = makeFakeRoom()
    const actions = createTypedActions(room)
    const snapshot = {
      currentItem: item,
      sessionName: 'Sprint 42',
      unit: 'weeks' as const,
      revealed: false,
      round: 3,
      roster: [{ participantId: 'a', submitted: false, connected: true }],
      submissions: [],
      finalizedItemIds: [],
    }

    actions.sendSyncState(snapshot)

    expect(actionsByName.syncState!.send).toHaveBeenCalledWith(snapshot)
  })

  it('filters invalid submissions out of an incoming snapshot before forwarding', () => {
    const { room, actionsByName } = makeFakeRoom()
    const actions = createTypedActions(room)
    const cb = vi.fn()
    actions.onSyncState(cb)

    actionsByName.syncState!.onMessage?.(
      {
        currentItem: item,
        unit: 'days',
        round: 1,
        submissions: [
          { participantId: 'a', best: 1, likely: 2, worst: 3 },
          { participantId: 'b', best: 9, likely: 2, worst: 3 },
        ],
        finalizedItemIds: ['item-0'],
      },
      { peerId: 'peer-1' },
    )

    expect(cb).toHaveBeenCalledWith(
      {
        currentItem: item,
        sessionName: '',
        unit: 'days',
        revealed: false,
        round: 1,
        roster: [],
        submissions: [{ participantId: 'a', best: 1, likely: 2, worst: 3 }],
        finalizedItemIds: ['item-0'],
      },
      'peer-1',
    )
  })

  it('drops a completely malformed submission entry without losing the rest of the snapshot', () => {
    const { room, actionsByName } = makeFakeRoom()
    const actions = createTypedActions(room)
    const cb = vi.fn()
    actions.onSyncState(cb)

    actionsByName.syncState!.onMessage?.(
      {
        currentItem: item,
        unit: 'days',
        round: 1,
        submissions: [null, { participantId: 'a', best: 1, likely: 2, worst: 3 }],
        finalizedItemIds: ['item-0'],
      },
      { peerId: 'peer-1' },
    )

    expect(cb).toHaveBeenCalledWith(
      {
        currentItem: item,
        sessionName: '',
        unit: 'days',
        revealed: false,
        round: 1,
        roster: [],
        submissions: [{ participantId: 'a', best: 1, likely: 2, worst: 3 }],
        finalizedItemIds: ['item-0'],
      },
      'peer-1',
    )
  })

  it('filters malformed entries out of an incoming snapshot roster before forwarding', () => {
    const { room, actionsByName } = makeFakeRoom()
    const actions = createTypedActions(room)
    const cb = vi.fn()
    actions.onSyncState(cb)

    actionsByName.syncState!.onMessage?.(
      {
        currentItem: item,
        unit: 'days',
        round: 1,
        roster: [
          { participantId: 'a', submitted: true, connected: true },
          { participantId: 'b', submitted: 'yes', connected: true },
          null,
        ],
        submissions: [],
        finalizedItemIds: [],
      },
      { peerId: 'peer-1' },
    )

    expect(cb).toHaveBeenCalledWith(
      expect.objectContaining({
        roster: [{ participantId: 'a', submitted: true, connected: true }],
      }),
      'peer-1',
    )
  })

  it('forwards the revealed flag from an incoming snapshot', () => {
    const { room, actionsByName } = makeFakeRoom()
    const actions = createTypedActions(room)
    const cb = vi.fn()
    actions.onSyncState(cb)

    actionsByName.syncState!.onMessage?.(
      {
        currentItem: item,
        unit: 'days',
        revealed: true,
        submissions: [],
        finalizedItemIds: [],
      },
      { peerId: 'peer-1' },
    )

    expect(cb).toHaveBeenCalledWith(expect.objectContaining({ revealed: true }), 'peer-1')
  })

  it('falls back to 0 when an incoming snapshot has a missing or non-number round', () => {
    const { room, actionsByName } = makeFakeRoom()
    const actions = createTypedActions(room)
    const cb = vi.fn()
    actions.onSyncState(cb)

    actionsByName.syncState!.onMessage?.(
      { currentItem: item, unit: 'days', submissions: [], finalizedItemIds: [] },
      { peerId: 'peer-1' },
    )
    actionsByName.syncState!.onMessage?.(
      {
        currentItem: item,
        unit: 'days',
        round: 'two',
        submissions: [],
        finalizedItemIds: [],
      },
      { peerId: 'peer-2' },
    )

    expect(cb).toHaveBeenNthCalledWith(1, expect.objectContaining({ round: 0 }), 'peer-1')
    expect(cb).toHaveBeenNthCalledWith(2, expect.objectContaining({ round: 0 }), 'peer-2')
  })

  it('drops a non-object incoming snapshot without throwing', () => {
    const { room, actionsByName } = makeFakeRoom()
    const actions = createTypedActions(room)
    const cb = vi.fn()
    actions.onSyncState(cb)

    expect(() => {
      actionsByName.syncState!.onMessage?.(null, { peerId: 'peer-1' })
    }).not.toThrow()
    expect(cb).not.toHaveBeenCalled()
  })

  it('drops an incoming snapshot with a malformed currentItem/finalizedItemIds shape', () => {
    const { room, actionsByName } = makeFakeRoom()
    const actions = createTypedActions(room)
    const cb = vi.fn()
    actions.onSyncState(cb)

    actionsByName.syncState!.onMessage?.(
      { currentItem: { id: 42 }, submissions: [], finalizedItemIds: 'oops' },
      { peerId: 'peer-1' },
    )

    expect(cb).not.toHaveBeenCalled()
  })

  it('drops an incoming snapshot whose currentItem is missing title/description', () => {
    const { room, actionsByName } = makeFakeRoom()
    const actions = createTypedActions(room)
    const cb = vi.fn()
    actions.onSyncState(cb)

    actionsByName.syncState!.onMessage?.(
      { currentItem: { id: 'item-1' }, submissions: [], finalizedItemIds: [] },
      { peerId: 'peer-1' },
    )

    expect(cb).not.toHaveBeenCalled()
  })

  it('accepts an incoming snapshot with a null currentItem', () => {
    const { room, actionsByName } = makeFakeRoom()
    const actions = createTypedActions(room)
    const cb = vi.fn()
    actions.onSyncState(cb)

    actionsByName.syncState!.onMessage?.(
      { currentItem: null, unit: 'days', submissions: [], finalizedItemIds: [] },
      { peerId: 'peer-1' },
    )

    expect(cb).toHaveBeenCalledWith(
      {
        currentItem: null,
        sessionName: '',
        unit: 'days',
        revealed: false,
        round: 0,
        roster: [],
        submissions: [],
        finalizedItemIds: [],
      },
      'peer-1',
    )
  })

  it('falls back to days when an incoming snapshot has a missing or unknown unit', () => {
    const { room, actionsByName } = makeFakeRoom()
    const actions = createTypedActions(room)
    const cb = vi.fn()
    actions.onSyncState(cb)

    actionsByName.syncState!.onMessage?.(
      { currentItem: item, submissions: [], finalizedItemIds: [] },
      { peerId: 'peer-1' },
    )
    actionsByName.syncState!.onMessage?.(
      { currentItem: item, unit: 'fortnights', submissions: [], finalizedItemIds: [] },
      { peerId: 'peer-2' },
    )

    expect(cb).toHaveBeenNthCalledWith(
      1,
      {
        currentItem: item,
        sessionName: '',
        unit: 'days',
        revealed: false,
        round: 0,
        roster: [],
        submissions: [],
        finalizedItemIds: [],
      },
      'peer-1',
    )
    expect(cb).toHaveBeenNthCalledWith(
      2,
      {
        currentItem: item,
        sessionName: '',
        unit: 'days',
        revealed: false,
        round: 0,
        roster: [],
        submissions: [],
        finalizedItemIds: [],
      },
      'peer-2',
    )
  })

  it('requests a snapshot from the given peer through the requestSnapshot action', async () => {
    const { room, requestActionsByName } = makeFakeRoom()
    const actions = createTypedActions(room)
    const snapshot = {
      currentItem: null,
      sessionName: '',
      unit: 'days' as const,
      revealed: false,
      round: 0,
      roster: [],
      submissions: [],
      finalizedItemIds: [],
    }
    requestActionsByName.requestSnapshot!.request.mockResolvedValue(snapshot)

    const result = await actions.requestSnapshot('facilitator-peer')

    expect(requestActionsByName.requestSnapshot!.request).toHaveBeenCalledWith(null, {
      target: 'facilitator-peer',
      timeoutMs: 800,
    })
    expect(result).toEqual(snapshot)
  })

  it('sanitizes the roster/submissions of a pulled snapshot the same as a pushed one', async () => {
    const { room, requestActionsByName } = makeFakeRoom()
    const actions = createTypedActions(room)
    requestActionsByName.requestSnapshot!.request.mockResolvedValue({
      currentItem: null,
      unit: 'days',
      revealed: false,
      round: 0,
      roster: [
        { participantId: 'a', submitted: true, connected: true },
        { participantId: 'b', submitted: 'yes', connected: true },
      ],
      submissions: [],
      finalizedItemIds: [],
    })

    const result = await actions.requestSnapshot('facilitator-peer')

    expect(result.roster).toEqual([
      { participantId: 'a', submitted: true, connected: true },
    ])
  })

  it('rejects when a requestSnapshot response is malformed, rather than handing it to the store untrusted', async () => {
    const { room, requestActionsByName } = makeFakeRoom()
    const actions = createTypedActions(room)
    requestActionsByName.requestSnapshot!.request.mockResolvedValue({
      currentItem: { id: 42 },
      finalizedItemIds: 'oops',
    })

    await expect(actions.requestSnapshot('facilitator-peer')).rejects.toThrow()
  })

  it('answers a requestSnapshot pull through the registered responder', () => {
    const { room, requestActionsByName } = makeFakeRoom()
    const actions = createTypedActions(room)
    const snapshot = {
      currentItem: null,
      sessionName: '',
      unit: 'days' as const,
      revealed: false,
      round: 0,
      roster: [],
      submissions: [],
      finalizedItemIds: [],
    }
    const respond = vi.fn(() => snapshot)

    const unsubscribe = actions.onRequestSnapshot(respond)
    const result = requestActionsByName.requestSnapshot!.onRequest?.(null, {
      peerId: 'peer-1',
    })

    expect(respond).toHaveBeenCalled()
    expect(result).toBe(snapshot)

    unsubscribe()
    expect(requestActionsByName.requestSnapshot!.onRequest).toBeNull()
  })

  it('sends a participant announce through the announce action', () => {
    const { room, actionsByName } = makeFakeRoom()
    const actions = createTypedActions(room)

    actions.sendAnnounce({ participantId: 'p-1', name: 'Sam Rivera' })

    expect(actionsByName.announce!.send).toHaveBeenCalledWith({
      participantId: 'p-1',
      name: 'Sam Rivera',
    })
  })

  it('forwards a valid incoming announce, trimming the name, to subscribers', () => {
    const { room, actionsByName } = makeFakeRoom()
    const actions = createTypedActions(room)
    const cb = vi.fn()
    actions.onAnnounce(cb)

    actionsByName.announce!.onMessage?.(
      { participantId: 'p-2', name: '  Jordan  ' },
      { peerId: 'peer-2' },
    )

    expect(cb).toHaveBeenCalledWith({ participantId: 'p-2', name: 'Jordan' }, 'peer-2')
  })

  it('drops incoming announces with an empty/blank/missing name or blank participantId', () => {
    const { room, actionsByName } = makeFakeRoom()
    const actions = createTypedActions(room)
    const cb = vi.fn()
    actions.onAnnounce(cb)

    actionsByName.announce!.onMessage?.(
      { participantId: 'p-1', name: '   ' },
      { peerId: 'peer-1' },
    )
    actionsByName.announce!.onMessage?.({ participantId: 'p-1' }, { peerId: 'peer-1' })
    actionsByName.announce!.onMessage?.({ name: 'Sam' }, { peerId: 'peer-1' })
    actionsByName.announce!.onMessage?.(
      { participantId: '', name: 'Sam' },
      { peerId: 'peer-1' },
    )
    actionsByName.announce!.onMessage?.(
      { participantId: '   ', name: 'Sam' },
      { peerId: 'peer-1' },
    )

    expect(cb).not.toHaveBeenCalled()
  })

  it('truncates an over-long incoming announce name', () => {
    const { room, actionsByName } = makeFakeRoom()
    const actions = createTypedActions(room)
    const cb = vi.fn()
    actions.onAnnounce(cb)

    actionsByName.announce!.onMessage?.(
      { participantId: 'p-1', name: 'x'.repeat(5000) },
      { peerId: 'peer-1' },
    )

    expect(cb).toHaveBeenCalledWith(
      { participantId: 'p-1', name: 'x'.repeat(MAX_ANNOUNCE_NAME_LENGTH) },
      'peer-1',
    )
  })

  it('drops a non-object incoming announce without throwing', () => {
    const { room, actionsByName } = makeFakeRoom()
    const actions = createTypedActions(room)
    const cb = vi.fn()
    actions.onAnnounce(cb)

    expect(() => {
      actionsByName.announce!.onMessage?.(null, { peerId: 'peer-1' })
    }).not.toThrow()
    expect(cb).not.toHaveBeenCalled()
  })

  it('stops notifying an estimate subscriber after unsubscribe', () => {
    const { room, requestActionsByName } = makeFakeRoom()
    const actions = createTypedActions(room)
    const cb = vi.fn()
    const unsubscribe = actions.onEstimate(cb)
    unsubscribe()

    requestActionsByName.submitEstimate!.onRequest?.(
      {
        itemId: 'item-1',
        estimate: { participantId: 'b', best: 1, likely: 2, worst: 3 },
      },
      { peerId: 'peer-1' },
    )

    expect(cb).not.toHaveBeenCalled()
  })
})
