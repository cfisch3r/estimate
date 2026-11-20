import type { CandidateKind, CandidateProtocol, CandidateType } from './types'

const TYPES: readonly CandidateType[] = ['host', 'srflx', 'prflx', 'relay']
const PROTOCOLS: readonly CandidateProtocol[] = ['udp', 'tcp']

const isType = (token: string | undefined): token is CandidateType =>
  TYPES.includes(token as CandidateType)
const isProtocol = (token: string | undefined): token is CandidateProtocol =>
  PROTOCOLS.includes(token as CandidateProtocol)

/** The type and protocol of an ICE candidate line (RFC 8839:
 *  `candidate:<foundation> <component> <protocol> <priority> <address> <port>
 *  typ <type> …`), or null if the line isn't one. Reads only those two tokens:
 *  the address, port and related address never leave this function, so the
 *  diagnosis can't record them. */
export function parseCandidate(line: string): CandidateKind | null {
  const tokens = line.trim().replace(/^a=/, '').split(/\s+/)
  if (!tokens[0]?.startsWith('candidate:')) return null
  const protocol = tokens[2]?.toLowerCase()
  const type = tokens[tokens.indexOf('typ') + 1]
  if (!tokens.includes('typ') || !isType(type) || !isProtocol(protocol)) return null
  return { type, protocol }
}

/** The kinds of every candidate a session description (SDP) carries. */
export function candidatesInSdp(sdp: string): CandidateKind[] {
  return sdp
    .split(/\r?\n/)
    .filter((line) => line.startsWith('a=candidate:'))
    .map(parseCandidate)
    .filter((kind) => kind !== null)
}
