import type { CandidateKind, CandidateProtocol, CandidateType } from './types'

const TYPES: readonly CandidateType[] = ['host', 'srflx', 'prflx', 'relay']
const PROTOCOLS: readonly CandidateProtocol[] = ['udp', 'tcp']

const isType = (value: unknown): value is CandidateType =>
  TYPES.includes(value as CandidateType)
const isProtocol = (value: unknown): value is CandidateProtocol =>
  PROTOCOLS.includes(value as CandidateProtocol)

/** A candidate's kind from its type and protocol, or null if either is unknown.
 *  Takes `unknown`, because `getStats()` reports them as untyped values. */
export function candidateKind(type: unknown, protocol: unknown): CandidateKind | null {
  return isType(type) && isProtocol(protocol) ? { type, protocol } : null
}

/** The type and protocol of an ICE candidate line (RFC 8839:
 *  `candidate:<foundation> <component> <protocol> <priority> <address> <port>
 *  typ <type> …`), or null if the line isn't one. Reads only those two tokens:
 *  the address, port and related address never leave this function, so the
 *  diagnosis can't record them. */
export function parseCandidate(line: string): CandidateKind | null {
  const tokens = line.trim().replace(/^a=/, '').split(/\s+/)
  if (!tokens[0]?.startsWith('candidate:')) return null
  if (!tokens.includes('typ')) return null
  return candidateKind(tokens[tokens.indexOf('typ') + 1], tokens[2]?.toLowerCase())
}

/** The kinds of every candidate a session description (SDP) carries. */
export function candidatesInSdp(sdp: string): CandidateKind[] {
  return sdp
    .split(/\r?\n/)
    .filter((line) => line.startsWith('a=candidate:'))
    .map(parseCandidate)
    .filter((kind) => kind !== null)
}
