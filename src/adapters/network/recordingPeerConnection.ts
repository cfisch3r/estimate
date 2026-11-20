import { candidatesInSdp } from '../../domain/diagnosis/candidates'
import type { CandidateKind, DiagnosticEvent } from '../../domain/diagnosis/types'

/** States after which a connection's candidates are final. */
const SETTLED: ReadonlySet<string> = new Set(['connected', 'failed', 'closed'])

type StatsRecord = Record<string, unknown>

/** The kind of a candidate as `getStats()` reports it, or undefined. */
function kindOf(stat: StatsRecord | undefined): CandidateKind | undefined {
  const type = stat?.['candidateType']
  const protocol = stat?.['protocol']
  return (type === 'host' || type === 'srflx' || type === 'prflx' || type === 'relay') &&
    (protocol === 'udp' || protocol === 'tcp')
    ? { type, protocol }
    : undefined
}

/** The candidate pair the connection is using, by kind only. */
async function selectedPair(
  connection: RTCPeerConnection,
): Promise<{ local: CandidateKind; remote: CandidateKind } | undefined> {
  const stats = new Map<string, StatsRecord>()
  ;(await connection.getStats()).forEach((stat: StatsRecord, id: string) =>
    stats.set(id, stat),
  )
  const pairId = [...stats.values()].find((stat) => stat['type'] === 'transport')?.[
    'selectedCandidatePairId'
  ]
  const pair = typeof pairId === 'string' ? stats.get(pairId) : undefined
  const local = kindOf(stats.get(String(pair?.['localCandidateId'])))
  const remote = kindOf(stats.get(String(pair?.['remoteCandidateId'])))
  return local && remote ? { local, remote } : undefined
}

/** An `RTCPeerConnection` that records what happens to it, for Trystero's
 *  `rtcPolyfill` option (issue #229). It records only once it has a remote
 *  description, because Trystero keeps spare offer connections that may never
 *  be used; it numbers those attempts in the order they begin. Every recording
 *  is wrapped, so a failing `record` never reaches the connection. Returns
 *  undefined where the browser has no `RTCPeerConnection`, so Trystero falls
 *  back to its own default. */
export function createRecordingPeerConnection(
  record: (event: DiagnosticEvent) => void,
  Base: typeof RTCPeerConnection | undefined = globalThis.RTCPeerConnection,
): typeof RTCPeerConnection | undefined {
  if (!Base) return undefined
  let attempts = 0
  const safely = (event: DiagnosticEvent) => {
    try {
      record(event)
    } catch {
      // The diagnosis is never worth a broken connection.
    }
  }

  return class RecordingPeerConnection extends Base {
    constructor(...args: ConstructorParameters<typeof RTCPeerConnection>) {
      super(...args)
      let attempt: number | undefined
      let candidatesRecorded = false

      this.addEventListener('signalingstatechange', () => {
        if (attempt === undefined && this.remoteDescription) attempt = ++attempts
      })

      this.addEventListener('connectionstatechange', () => {
        if (attempt === undefined) return
        const number = attempt
        safely({
          kind: 'rtc-state',
          attempt: number,
          connectionState: this.connectionState,
          iceConnectionState: this.iceConnectionState,
        })
        if (SETTLED.has(this.connectionState) && !candidatesRecorded) {
          candidatesRecorded = true
          for (const [side, description] of [
            ['local', this.localDescription],
            ['remote', this.remoteDescription],
          ] as const) {
            safely({
              kind: 'rtc-candidates',
              attempt: number,
              side,
              candidates: candidatesInSdp(description?.sdp ?? ''),
            })
          }
        }
        if (this.connectionState === 'connected') {
          selectedPair(this)
            .then((pair) => {
              if (pair) safely({ kind: 'rtc-selected', attempt: number, ...pair })
            })
            .catch(() => {
              // Stats can't be read once the connection closes; the pair stays unknown.
            })
        }
      })
    }
  }
}
