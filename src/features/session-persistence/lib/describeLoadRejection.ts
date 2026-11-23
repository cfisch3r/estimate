import type { SessionFileRejection } from '../../../application'

type Code = SessionFileRejection['code']

/** One sentence per reason, worded for the person who picked the file. A
 *  Record, not a switch, so a new reason without a sentence doesn't compile. */
const REJECTION_TEXT: {
  [K in Code]: (rejection: Extract<SessionFileRejection, { code: K }>) => string
} = {
  unreadable: () => "This file couldn't be read. Pick it again.",
  'not-a-session-file': () => "This isn't an EstiMate session file.",
  'newer-version': () => 'This file was saved by a newer version of EstiMate.',
  'unknown-unit': ({ unit }) => `The unit "${unit}" isn't one EstiMate can estimate in.`,
  'item-without-id': ({ position }) => `Item ${position} has no id.`,
  'item-without-title': ({ position }) => `Item ${position} has no title.`,
  'duplicate-item-id': ({ position, samePositionAs }) =>
    `Item ${position} has the same id as item ${samePositionAs}.`,
  'broken-final-result': ({ position, title, reason }) =>
    `Item ${position}, "${title}", ${reason}.`,
}

/** Why a picked file wasn't loaded, as the sentence the load alert shows. */
export function describeLoadRejection(rejection: SessionFileRejection): string {
  const describe = REJECTION_TEXT[rejection.code] as (r: SessionFileRejection) => string
  return describe(rejection)
}
