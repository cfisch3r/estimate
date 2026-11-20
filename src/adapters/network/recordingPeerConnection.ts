import { candidateKind, candidatesInSdp } from '../../domain/diagnosis/candidates'
import type { CandidateKind, DiagnosticEvent } from '../../domain/diagnosis/types'

/** States after which a connection's candidates are final. `closed` is not one:
 *  only `close()` reaches it, and that fires no event (see `close` below). */
const SETTLED: ReadonlySet<string> = new Set(['connected', 'failed'])

type StatsRecord = Record<string, unknown>

/** The kind of a candidate as `getStats()` reports it, or undefined. */
function kindOf(stat: StatsRecord | undefined): CandidateKind | undefined {
  return candidateKind(stat?.['candidateType'], stat?.['protocol']) ?? undefined
}

/** The pair the transport names (Chromium, Safari), or else the pair marked
 *  selected, or nominated and succeeded (Firefox, which names none). */
function selectedPairStat(stats: Map<string, StatsRecord>): StatsRecord | undefined {
  const all = [...stats.values()]
  const pairId = all.find((stat) => stat['type'] === 'transport')?.[
    'selectedCandidatePairId'
  ]
  if (typeof pairId === 'string') return stats.get(pairId)
  return all.find(
    (stat) =>
      stat['type'] === 'candidate-pair' &&
      (stat['selected'] === true ||
        (stat['nominated'] === true && stat['state'] === 'succeeded')),
  )
}

/** The candidate pair the connection is using, by kind only. */
async function selectedPair(
  connection: RTCPeerConnection,
): Promise<{ local: CandidateKind; remote: CandidateKind } | undefined> {
  const stats = new Map<string, StatsRecord>()
  ;(await connection.getStats()).forEach((stat: StatsRecord, id: string) =>
    stats.set(id, stat),
  )
  const pair = selectedPairStat(stats)
  const local = kindOf(stats.get(String(pair?.['localCandidateId'])))
  const remote = kindOf(stats.get(String(pair?.['remoteCandidateId'])))
  return local && remote ? { local, remote } : undefined
}

/** An `RTCPeerConnection` that records what happens to it, for Trystero's
 *  `rtcPolyfill` option (issue #229). It records only once it has a remote
 *  description, because Trystero keeps spare offer connections that may never
 *  be used; it numbers those attempts in the order they begin, across every
 *  connection built from the returned class. Every recording is wrapped, so a
 *  failing `record` never reaches the connection, which runs inside Trystero. Returns
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
    #attempt: number | undefined
    #candidatesRecorded = false

    constructor(...args: ConstructorParameters<typeof RTCPeerConnection>) {
      super(...args)
      this.addEventListener('signalingstatechange', () => {
        if (this.#attempt === undefined && this.remoteDescription) {
          this.#attempt = ++attempts
        }
      })
      this.addEventListener('connectionstatechange', () => {
        const attempt = this.#attempt
        if (attempt === undefined) return
        safely({
          kind: 'rtc-state',
          attempt,
          connectionState: this.connectionState,
          iceConnectionState: this.iceConnectionState,
        })
        if (SETTLED.has(this.connectionState)) this.#recordCandidates(attempt)
        if (this.connectionState === 'connected') {
          selectedPair(this)
            .then((pair) => {
              if (pair) safely({ kind: 'rtc-selected', attempt, ...pair })
            })
            .catch(() => {
              // Stats can't be read once the connection closes; the pair stays unknown.
            })
        }
      })
    }

    /** Trystero closes an attempt that never connected, often before it changed
     *  state at all, and `close()` fires no event. So the attempt is recorded
     *  here: its candidates, if not yet, and how far it got (the ICE state). */
    override close(): void {
      const attempt = this.#attempt
      if (attempt !== undefined && this.connectionState !== 'closed') {
        this.#recordCandidates(attempt)
        safely({
          kind: 'rtc-state',
          attempt,
          connectionState: 'closed',
          iceConnectionState: this.iceConnectionState,
        })
      }
      super.close()
    }

    /** Both sides' candidate kinds, once: they're final when the attempt settles. */
    #recordCandidates(attempt: number): void {
      if (this.#candidatesRecorded) return
      this.#candidatesRecorded = true
      for (const [side, description] of [
        ['local', this.localDescription],
        ['remote', this.remoteDescription],
      ] as const) {
        safely({
          kind: 'rtc-candidates',
          attempt,
          side,
          candidates: candidatesInSdp(description?.sdp ?? ''),
        })
      }
    }
  }
}
