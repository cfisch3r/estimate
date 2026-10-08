export interface RetryOptions {
  /** Max retry attempts after the first. Defaults to `backoffMs.length`. */
  retries?: number
  /** Delay before each retry, indexed by attempt number. The last entry repeats
   *  if `retries` exceeds its length. */
  backoffMs?: number[]
  /** Overridable for tests (fake timers). */
  delay?: (ms: number) => Promise<void>
}

const defaultDelay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms))

/** Applies ADR-003's "Acknowledged submissions" retry table to any Trystero
 *  `request(...)` call: only a `timeout` (link alive, facilitator didn't answer)
 *  is worth retrying. `disconnected` and `aborted` reject instantly rather than
 *  waiting out a timeout, so retrying into them can't ever succeed — it would
 *  only spend the 5s ICE-teardown budget a reconnect needs instead. Any other
 *  kind (a thrown handler, or none registered) surfaces after the one attempt
 *  that already happened. */
export async function withKindDrivenRetry<T>(
  attempt: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const backoffMs = options.backoffMs ?? [500, 1500]
  const retries = options.retries ?? backoffMs.length
  const delay = options.delay ?? defaultDelay
  // Only reached when `retries` > 0, which (absent an explicit `retries` override)
  // implies `backoffMs` is non-empty — so the fallback here is unreachable, not unsafe.
  const lastBackoffMs = backoffMs.length > 0 ? backoffMs[backoffMs.length - 1]! : 0
  for (let attemptIndex = 0; ; attemptIndex++) {
    try {
      return await attempt()
    } catch (error) {
      const kind = (error as { kind?: unknown } | null)?.kind
      if (kind !== 'timeout' || attemptIndex >= retries) throw error
      await delay(backoffMs[attemptIndex] ?? lastBackoffMs)
    }
  }
}
