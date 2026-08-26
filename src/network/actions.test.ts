import { describe, expect, it, vi } from 'vitest'
import { createTypedActions, type ActionRoom } from './actions'
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
  it('sends an estimate through the submitEstimate action', () => {
    const { room, actionsByName } = makeFakeRoom()
    const actions = createTypedActions(room)

    actions.sendEstimate(validEstimate.value)

    expect(actionsByName.submitEstimate!.send).toHaveBeenCalledWith(validEstimate.value)
  })

  it('forwards a valid incoming estimate to subscribers', () => {
    const { room, actionsByName } = makeFakeRoom()
    const actions = createTypedActions(room)
    const cb = vi.fn()
    actions.onEstimate(cb)

    actionsByName.submitEstimate!.onMessage?.(
      { participantId: 'b', best: 1, likely: 2, worst: 3 },
      { peerId: 'peer-1' },
    )

    expect(cb).toHaveBeenCalledWith(
      { participantId: 'b', best: 1, likely: 2, worst: 3 },
      'peer-1',
    )
  })

  it('drops a malformed incoming estimate instead of forwarding it', () => {
    const { room, actionsByName } = makeFakeRoom()
    const actions = createTypedActions(room)
    const cb = vi.fn()
    actions.onEstimate(cb)

    actionsByName.submitEstimate!.onMessage?.(
      { participantId: 'b', best: 9, likely: 2, worst: 3 },
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

  it('sends a snapshot through the syncState action', () => {
    const { room, actionsByName } = makeFakeRoom()
    const actions = createTypedActions(room)
    const snapshot = { currentItemId: 'item-1', submissions: [], finalizedItemIds: [] }

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
        currentItemId: 'item-1',
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
        currentItemId: 'item-1',
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
        currentItemId: 'item-1',
        submissions: [null, { participantId: 'a', best: 1, likely: 2, worst: 3 }],
        finalizedItemIds: ['item-0'],
      },
      { peerId: 'peer-1' },
    )

    expect(cb).toHaveBeenCalledWith(
      {
        currentItemId: 'item-1',
        submissions: [{ participantId: 'a', best: 1, likely: 2, worst: 3 }],
        finalizedItemIds: ['item-0'],
      },
      'peer-1',
    )
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

  it('drops an incoming snapshot with a malformed currentItemId/finalizedItemIds shape', () => {
    const { room, actionsByName } = makeFakeRoom()
    const actions = createTypedActions(room)
    const cb = vi.fn()
    actions.onSyncState(cb)

    actionsByName.syncState!.onMessage?.(
      { currentItemId: 42, submissions: [], finalizedItemIds: 'oops' },
      { peerId: 'peer-1' },
    )

    expect(cb).not.toHaveBeenCalled()
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

  it('stops notifying an estimate subscriber after unsubscribe', () => {
    const { room, actionsByName } = makeFakeRoom()
    const actions = createTypedActions(room)
    const cb = vi.fn()
    const unsubscribe = actions.onEstimate(cb)
    unsubscribe()

    actionsByName.submitEstimate!.onMessage?.(
      { participantId: 'b', best: 1, likely: 2, worst: 3 },
      { peerId: 'peer-1' },
    )

    expect(cb).not.toHaveBeenCalled()
  })
})
