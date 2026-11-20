import { describe, expect, it, vi } from 'vitest'
import type { DiagnosticEvent } from '../../domain/diagnosis/types'
import { createRecordingPeerConnection } from './recordingPeerConnection'

const LOCAL_SDP = [
  'v=0',
  'a=candidate:1 1 udp 2122260223 192.168.1.5 54321 typ host',
  'a=candidate:2 1 tcp 1518280447 192.168.1.5 9 typ host tcptype active',
].join('\r\n')
const REMOTE_SDP = [
  'v=0',
  'a=candidate:1 1 udp 2122260223 4f1c2b0e-7a2d.local 61665 typ host',
  'a=candidate:3 1 udp 1686052607 203.0.113.9 61666 typ srflx raddr 0.0.0.0 rport 0',
].join('\r\n')

/** Just enough of `RTCPeerConnection` for the recorder: the descriptions, the
 *  two states, the events and `getStats`. */
class FakePeerConnection extends EventTarget {
  remoteDescription: { sdp: string } | null = null
  localDescription: { sdp: string } | null = { sdp: LOCAL_SDP }
  connectionState = 'new'
  iceConnectionState = 'new'
  stats = new Map<string, Record<string, unknown>>([
    ['T1', { type: 'transport', selectedCandidatePairId: 'P1' }],
    ['P1', { type: 'candidate-pair', localCandidateId: 'L1', remoteCandidateId: 'R1' }],
    [
      'L1',
      {
        type: 'local-candidate',
        candidateType: 'host',
        protocol: 'udp',
        address: '192.168.1.5',
      },
    ],
    [
      'R1',
      {
        type: 'remote-candidate',
        candidateType: 'srflx',
        protocol: 'udp',
        address: '203.0.113.9',
      },
    ],
  ])
  readonly config: unknown

  constructor(config?: unknown) {
    super()
    this.config = config
  }

  async getStats() {
    return this.stats
  }

  /** Like the browser's: the state becomes closed, but no event fires. */
  close() {
    this.connectionState = 'closed'
    this.iceConnectionState = 'closed'
  }

  receiveRemote(sdp = REMOTE_SDP) {
    this.remoteDescription = { sdp }
    this.dispatchEvent(new Event('signalingstatechange'))
  }

  moveTo(state: string, ice = state) {
    this.connectionState = state
    this.iceConnectionState = ice
    this.dispatchEvent(new Event('connectionstatechange'))
  }
}

function recorder() {
  const events: DiagnosticEvent[] = []
  const Recording = createRecordingPeerConnection(
    (event) => events.push(event),
    FakePeerConnection as unknown as typeof RTCPeerConnection,
  )
  if (!Recording) throw new Error('expected a recording class')
  const open = () => new Recording({ iceServers: [] }) as unknown as FakePeerConnection
  return { events, open }
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('createRecordingPeerConnection', () => {
  it('passes its configuration to the browser connection', () => {
    const { open } = recorder()
    expect(open().config).toEqual({ iceServers: [] })
  })

  it('records nothing for a connection that never gets a remote description', () => {
    const { events, open } = recorder()
    const unused = open()

    unused.moveTo('connecting')
    unused.moveTo('failed')

    expect(events).toEqual([])
  })

  it('numbers attempts in the order they get a remote description', async () => {
    const { events, open } = recorder()
    const first = open()
    const second = open()
    second.receiveRemote()
    first.receiveRemote()
    second.receiveRemote()

    first.moveTo('connecting')
    second.moveTo('connecting')

    expect(events).toEqual([
      {
        kind: 'rtc-state',
        attempt: 2,
        connectionState: 'connecting',
        iceConnectionState: 'connecting',
      },
      {
        kind: 'rtc-state',
        attempt: 1,
        connectionState: 'connecting',
        iceConnectionState: 'connecting',
      },
    ])
  })

  it('records the candidates and the selected pair of a connection that connected', async () => {
    const { events, open } = recorder()
    const connection = open()
    connection.receiveRemote()

    connection.moveTo('connected', 'checking')
    await settle()

    expect(events).toEqual([
      {
        kind: 'rtc-state',
        attempt: 1,
        connectionState: 'connected',
        iceConnectionState: 'checking',
      },
      {
        kind: 'rtc-candidates',
        attempt: 1,
        side: 'local',
        candidates: [
          { type: 'host', protocol: 'udp' },
          { type: 'host', protocol: 'tcp' },
        ],
      },
      {
        kind: 'rtc-candidates',
        attempt: 1,
        side: 'remote',
        candidates: [
          { type: 'host', protocol: 'udp' },
          { type: 'srflx', protocol: 'udp' },
        ],
      },
      {
        kind: 'rtc-selected',
        attempt: 1,
        local: { type: 'host', protocol: 'udp' },
        remote: { type: 'srflx', protocol: 'udp' },
      },
    ])
  })

  it('records the candidates once, and no selected pair, when the connection fails', async () => {
    const { events, open } = recorder()
    const connection = open()
    connection.localDescription = null
    connection.receiveRemote()

    connection.moveTo('failed')
    connection.moveTo('closed')
    await settle()

    expect(events.map((event) => event.kind)).toEqual([
      'rtc-state',
      'rtc-candidates',
      'rtc-candidates',
      'rtc-state',
    ])
    expect(events[1]).toMatchObject({ side: 'local', candidates: [] })
  })

  it('records an attempt that is closed before it ever changed state', () => {
    const { events, open } = recorder()
    const connection = open()
    connection.localDescription = null
    connection.receiveRemote()

    connection.close()
    connection.close()

    expect(events).toEqual([
      {
        kind: 'rtc-candidates',
        attempt: 1,
        side: 'local',
        candidates: [],
      },
      {
        kind: 'rtc-candidates',
        attempt: 1,
        side: 'remote',
        candidates: [
          { type: 'host', protocol: 'udp' },
          { type: 'srflx', protocol: 'udp' },
        ],
      },
      {
        kind: 'rtc-state',
        attempt: 1,
        connectionState: 'closed',
        iceConnectionState: 'new',
      },
    ])
  })

  it('records only the closing state of an attempt whose candidates are known', async () => {
    const { events, open } = recorder()
    const connection = open()
    connection.receiveRemote()
    connection.moveTo('connected')
    await settle()

    connection.close()

    expect(events.at(-1)).toEqual({
      kind: 'rtc-state',
      attempt: 1,
      connectionState: 'closed',
      iceConnectionState: 'connected',
    })
    expect(events.filter((event) => event.kind === 'rtc-candidates')).toHaveLength(2)
  })

  it('records nothing when an unused connection is closed', () => {
    const { events, open } = recorder()
    open().close()
    expect(events).toEqual([])
  })

  it.each([
    ['selected', { selected: true }],
    ['nominated and succeeded', { nominated: true, state: 'succeeded' }],
  ])(
    "finds the selected pair in Firefox's stats, which mark the pair %s",
    async (_name, mark) => {
      const { events, open } = recorder()
      const connection = open()
      connection.stats = new Map([
        ['T1', { type: 'transport' }],
        [
          'P0',
          { type: 'candidate-pair', localCandidateId: 'R1', remoteCandidateId: 'R1' },
        ],
        [
          'P1',
          {
            type: 'candidate-pair',
            localCandidateId: 'L1',
            remoteCandidateId: 'R1',
            ...mark,
          },
        ],
        ...[...connection.stats].filter(([id]) => id === 'L1' || id === 'R1'),
      ])
      connection.receiveRemote()

      connection.moveTo('connected')
      await settle()

      expect(events).toContainEqual({
        kind: 'rtc-selected',
        attempt: 1,
        local: { type: 'host', protocol: 'udp' },
        remote: { type: 'srflx', protocol: 'udp' },
      })
    },
  )

  it('records no selected pair when the stats name none', async () => {
    const { events, open } = recorder()
    const connection = open()
    connection.stats = new Map([['T1', { type: 'transport' }]])
    connection.receiveRemote()

    connection.moveTo('connected')
    await settle()

    expect(events.some((event) => event.kind === 'rtc-selected')).toBe(false)
  })

  it('records no selected pair when the stats can not be read', async () => {
    const { events, open } = recorder()
    const connection = open()
    connection.getStats = () => Promise.reject(new Error('closed'))
    connection.receiveRemote()

    connection.moveTo('connected')
    await settle()

    expect(events.some((event) => event.kind === 'rtc-selected')).toBe(false)
  })

  it('keeps no address of any candidate', async () => {
    const { events, open } = recorder()
    const connection = open()
    connection.receiveRemote()
    connection.moveTo('connected')
    await settle()

    expect(JSON.stringify(events)).not.toMatch(/\d+\.\d+\.\d+\.\d+|\.local|::/)
  })

  it('lets the connection work on when recording throws', () => {
    const Recording = createRecordingPeerConnection(
      () => {
        throw new Error('storage is gone')
      },
      FakePeerConnection as unknown as typeof RTCPeerConnection,
    )
    const connection = new Recording!() as unknown as FakePeerConnection
    const listener = vi.fn()
    connection.addEventListener('connectionstatechange', listener)
    connection.receiveRemote()

    expect(() => connection.moveTo('connected')).not.toThrow()
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('returns nothing where the browser has no RTCPeerConnection', () => {
    expect(createRecordingPeerConnection(() => {}, undefined)).toBeUndefined()
  })
})
