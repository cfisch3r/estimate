import { describe, expect, it } from 'vitest'
import { candidatesInSdp, parseCandidate } from './candidates'

const HOST_V4 =
  'candidate:842163049 1 udp 1677729535 192.168.1.5 54321 typ host generation 0'
const SRFLX_V6 =
  'candidate:1 1 UDP 1686052607 2001:db8::7 61665 typ srflx raddr fe80::1 rport 61665'
const HOST_MDNS_TCP =
  'candidate:3 1 tcp 1518280447 4f1c2b0e-7a2d-4d1e-9c11-0d6b1f3e2a90.local 9 typ host tcptype active'

describe('parseCandidate', () => {
  it('reads the type and protocol of a host candidate', () => {
    expect(parseCandidate(HOST_V4)).toEqual({ type: 'host', protocol: 'udp' })
  })

  it('reads an IPv6 server-reflexive candidate, ignoring raddr and rport', () => {
    expect(parseCandidate(SRFLX_V6)).toEqual({ type: 'srflx', protocol: 'udp' })
  })

  it('reads a TCP candidate behind an mDNS host name', () => {
    expect(parseCandidate(HOST_MDNS_TCP)).toEqual({ type: 'host', protocol: 'tcp' })
  })

  it('accepts the SDP form with its a= prefix', () => {
    expect(parseCandidate(`a=${HOST_V4}`)).toEqual({ type: 'host', protocol: 'udp' })
  })

  it.each(['prflx', 'relay'] as const)('reads a %s candidate', (type) => {
    expect(parseCandidate(`candidate:1 1 udp 1 10.0.0.1 1 typ ${type}`)).toEqual({
      type,
      protocol: 'udp',
    })
  })

  it.each([
    ['an empty string', ''],
    ['text that is no candidate', 'hello world'],
    ['a candidate without typ', 'candidate:1 1 udp 1 10.0.0.1 1'],
    ['an unknown type', 'candidate:1 1 udp 1 10.0.0.1 1 typ magic'],
    ['an unknown protocol', 'candidate:1 1 sctp 1 10.0.0.1 1 typ host'],
  ])('returns null for %s', (_name, line) => {
    expect(parseCandidate(line)).toBeNull()
  })

  it('keeps nothing of the address, port or related address', () => {
    const kept = JSON.stringify([HOST_V4, SRFLX_V6, HOST_MDNS_TCP].map(parseCandidate))
    for (const leak of [
      '192.168',
      '54321',
      '2001:db8',
      'fe80',
      '61665',
      '.local',
      '4f1c2b0e',
    ]) {
      expect(kept).not.toContain(leak)
    }
  })
})

describe('candidatesInSdp', () => {
  it('reads every candidate line of a session description', () => {
    const sdp = [
      'v=0',
      'm=application 9 UDP/DTLS/SCTP webrtc-datachannel',
      `a=${HOST_V4}`,
      'a=ice-ufrag:abcd',
      `a=${SRFLX_V6}`,
      'a=candidate:broken',
    ].join('\r\n')
    expect(candidatesInSdp(sdp)).toEqual([
      { type: 'host', protocol: 'udp' },
      { type: 'srflx', protocol: 'udp' },
    ])
  })

  it('returns none for a description without candidates', () => {
    expect(candidatesInSdp('v=0\r\na=ice-ufrag:abcd')).toEqual([])
  })
})
