/** Enough of a Trystero peer id to tell the lines of one session apart; the
 *  ids are random per page load anyway. */
const SHORT_PEER_ID_LENGTH = 6

export function shortPeerId(peerId: string): string {
  return peerId.slice(0, SHORT_PEER_ID_LENGTH)
}

/** `text` with every full peer id in `peerIds` shortened, for error texts that
 *  embed one (Trystero's join errors do). */
export function shortenPeerIdsIn(text: string, peerIds: string[]): string {
  return peerIds
    .filter((peerId) => peerId !== '')
    .reduce(
      (shortened, peerId) => shortened.replaceAll(peerId, shortPeerId(peerId)),
      text,
    )
}
