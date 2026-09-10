import { describe, expect, it, vi } from 'vitest'
import { createTypedActions, MAX_ANNOUNCE_NAME_LENGTH, type ActionRoom } from './actions'
import { createEstimate } from '../calc'

function makeFakeAction() {
  return {
    send: vi.fn(),
    onMessage: null as ((data: unknown, ctx: { peerId: string }) => void) | null,
  }
}

function makeFakeRoom() {
  const actionsByName: Record<string, ReturnType<typeof makeFakeAction>> = {}
  const room: ActionRoom = {
    makeAction: vi.fn((name: string) => {
      actionsByName[name] = makeFakeAction()
      return actionsByName[name] as never
    }),
  }
  return { room, actionsByName }
}

const validEstimate = createEstimate({ participantId: 'a', best: 1, likely: 2, worst: 3 })
if (!validEstimate.ok) throw new Error('test fixture invalid')

describe('createTypedActions', () => {
  it('sends an estimate (with its item id) through the submitEstimate action', () => {
    const { room, actionsByName } = makeFakeRoom()
    const actions = createTypedActions(room)

    actions.sendEstimate('item-1', validEstimate.value)

    expect(actionsByName.submitEstimate!.send).toHaveBeenCalledWith({
      itemId: 'item-1',
      estimate: validEstimate.value,
    })
  })

  it('forwards a valid incoming estimate, with its item id, to subscribers', () => {
    const { room, actionsByName } = makeFakeRoom()
    const actions = createTypedActions(room)
    const cb = vi.fn()
    actions.onEstimate(cb)

    actionsByName.submitEstimate!.onMessage?.(
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
    )
  })

  it('drops an incoming estimate with no item id envelope', () => {
    const { room, actionsByName } = makeFakeRoom()
    const actions = createTypedActions(room)
    const cb = vi.fn()
    actions.onEstimate(cb)

    actionsByName.submitEstimate!.onMessage?.(
      { participantId: 'b', best: 1, likely: 2, worst: 3 },
      { peerId: 'peer-1' },
    )

    expect(cb).not.toHaveBeenCalled()
  })

  it('drops a malformed incoming estimate instead of forwarding it', () => {
    const { room, actionsByName } = makeFakeRoom()
    const actions = createTypedActions(room)
    const cb = vi.fn()
    actions.onEstimate(cb)

    actionsByName.submitEstimate!.onMessage?.(
      {
        itemId: 'item-1',
        estimate: { participantId: 'b', best: 9, likely: 2, worst: 3 },
      },
      { peerId: 'peer-1' },
    )

    expect(cb).not.toHaveBeenCalled()
  })

  it('drops a completely malformed incoming estimate (missing fields) without throwing', () => {
    const { room, actionsByName } = makeFakeRoom()
    const actions = createTypedActions(room)
    const cb = vi.fn()
    actions.onEstimate(cb)

    expect(() => {
      actionsByName.submitEstimate!.onMessage?.({}, { peerId: 'peer-1' })
      actionsByName.submitEstimate!.onMessage?.({ itemId: 'x' }, { peerId: 'peer-1' })
    }).not.toThrow()
    expect(cb).not.toHaveBeenCalled()
  })

  it('drops a null incoming estimate without throwing', () => {
    const { room, actionsByName } = makeFakeRoom()
    const actions = createTypedActions(room)
    const cb = vi.fn()
    actions.onEstimate(cb)

    expect(() => {
      actionsByName.submitEstimate!.onMessage?.(null, { peerId: 'peer-1' })
    }).not.toThrow()
    expect(cb).not.toHaveBeenCalled()
  })

  const item = { id: 'item-1', title: 'Retry queue', description: 'exponential backoff' }

  it('sends a snapshot through the syncState action', () => {
    const { room, actionsByName } = makeFakeRoom()
    const actions = createTypedActions(room)
    const snapshot = {
      currentItem: item,
      unit: 'weeks' as const,
      revealed: false,
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
        unit: 'days',
        revealed: false,
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
        submissions: [null, { participantId: 'a', best: 1, likely: 2, worst: 3 }],
        finalizedItemIds: ['item-0'],
      },
      { peerId: 'peer-1' },
    )

    expect(cb).toHaveBeenCalledWith(
      {
        currentItem: item,
        unit: 'days',
        revealed: false,
        submissions: [{ participantId: 'a', best: 1, likely: 2, worst: 3 }],
        finalizedItemIds: ['item-0'],
      },
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
        unit: 'days',
        revealed: false,
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
        unit: 'days',
        revealed: false,
        submissions: [],
        finalizedItemIds: [],
      },
      'peer-1',
    )
    expect(cb).toHaveBeenNthCalledWith(
      2,
      {
        currentItem: item,
        unit: 'days',
        revealed: false,
        submissions: [],
        finalizedItemIds: [],
      },
      'peer-2',
    )
  })

  it('sends an item id through the reveal action', () => {
    const { room, actionsByName } = makeFakeRoom()
    const actions = createTypedActions(room)

    actions.sendReveal('item-1')

    expect(actionsByName.reveal!.send).toHaveBeenCalledWith('item-1')
  })

  it('forwards a valid incoming reveal to subscribers', () => {
    const { room, actionsByName } = makeFakeRoom()
    const actions = createTypedActions(room)
    const cb = vi.fn()
    actions.onReveal(cb)

    actionsByName.reveal!.onMessage?.('item-1', { peerId: 'peer-1' })

    expect(cb).toHaveBeenCalledWith('item-1', 'peer-1')
  })

  it('drops a malformed incoming reveal payload', () => {
    const { room, actionsByName } = makeFakeRoom()
    const actions = createTypedActions(room)
    const cb = vi.fn()
    actions.onReveal(cb)

    actionsByName.reveal!.onMessage?.(42, { peerId: 'peer-1' })

    expect(cb).not.toHaveBeenCalled()
  })

  it('sends an item id through the roundReset action', () => {
    const { room, actionsByName } = makeFakeRoom()
    const actions = createTypedActions(room)

    actions.sendRoundReset('item-1')

    expect(actionsByName.roundReset!.send).toHaveBeenCalledWith('item-1')
  })

  it('forwards a valid incoming roundReset to subscribers', () => {
    const { room, actionsByName } = makeFakeRoom()
    const actions = createTypedActions(room)
    const cb = vi.fn()
    actions.onRoundReset(cb)

    actionsByName.roundReset!.onMessage?.('item-1', { peerId: 'peer-1' })

    expect(cb).toHaveBeenCalledWith('item-1', 'peer-1')
  })

  it('drops a malformed incoming roundReset payload', () => {
    const { room, actionsByName } = makeFakeRoom()
    const actions = createTypedActions(room)
    const cb = vi.fn()
    actions.onRoundReset(cb)

    actionsByName.roundReset!.onMessage?.(42, { peerId: 'peer-1' })

    expect(cb).not.toHaveBeenCalled()
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
    const { room, actionsByName } = makeFakeRoom()
    const actions = createTypedActions(room)
    const cb = vi.fn()
    const unsubscribe = actions.onEstimate(cb)
    unsubscribe()

    actionsByName.submitEstimate!.onMessage?.(
      {
        itemId: 'item-1',
        estimate: { participantId: 'b', best: 1, likely: 2, worst: 3 },
      },
      { peerId: 'peer-1' },
    )

    expect(cb).not.toHaveBeenCalled()
  })
})
