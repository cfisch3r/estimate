import { describe, expect, it } from 'vitest'
import type { SessionFileRejection } from '../../../application'
import { describeLoadRejection } from './describeLoadRejection'

describe('describeLoadRejection', () => {
  it.each<[SessionFileRejection, string]>([
    [{ code: 'unreadable' }, "This file couldn't be read. Pick it again."],
    [{ code: 'not-a-session-file' }, "This isn't an EstiMate session file."],
    [{ code: 'newer-version' }, 'This file was saved by a newer version of EstiMate.'],
    [
      { code: 'unknown-unit', unit: 'months' },
      'The unit "months" isn\'t one EstiMate can estimate in.',
    ],
    [{ code: 'item-without-id', position: 1 }, 'Item 1 has no id.'],
    [{ code: 'item-without-title', position: 2 }, 'Item 2 has no title.'],
    [
      { code: 'duplicate-item-id', position: 2, samePositionAs: 1 },
      'Item 2 has the same id as item 1.',
    ],
    [
      {
        code: 'broken-final-result',
        position: 1,
        title: 'Payment provider switch',
        reason: 'has a minimum of 0 or less',
      },
      'Item 1, "Payment provider switch", has a minimum of 0 or less.',
    ],
  ])('words %j as %j', (rejection, sentence) => {
    expect(describeLoadRejection(rejection)).toBe(sentence)
  })
})
