/** The reserved participant id the facilitator announces itself, and records its
 *  own estimates, under. A participant's id is a random UUID (see
 *  `getOrCreateParticipantId`), so it can never collide with this value. */
export const FACILITATOR_PARTICIPANT_ID = 'facilitator'

/** The stand-in id a participant's own estimate is recorded under before a join
 *  has stored a real one. */
export const LOCAL_PARTICIPANT_ID = 'me'
