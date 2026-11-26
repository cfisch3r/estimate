import type { JSHandle, Page } from '@playwright/test'
import type { DiagnosticsLog } from '../../../src/application/ports/outbound/diagnosticsLog'
import type { FileDownloadApi } from '../../../src/application/ports/outbound/fileDownload'
import type { JoinSession } from '../../../src/application/ports/outbound/networkTransport'
import type { ParticipantIdentityApi } from '../../../src/application/ports/outbound/participantIdentity'
import type { SessionFileApi } from '../../../src/application/ports/outbound/sessionFiles'

/** What the harness installs for a port: the adapter's own operations, without
 *  the port's `on…` callbacks, which can't cross from the page into Node. */
type HarnessEntry<Port> = {
  [K in keyof Port as K extends `on${string}` ? never : K]: Port[K]
}

/** A port as the steps see it from Node: every operation async, because each
 *  call is a round trip into the page. Derived from the port type, so a port
 *  change reaches every step through `pnpm typecheck`. */
export type Remote<Port> = {
  [K in keyof HarnessEntry<Port>]: HarnessEntry<Port>[K] extends (
    ...args: infer A
  ) => infer R
    ? (...args: A) => Promise<Awaited<R>>
    : never
}

/** A port's `on…` operations, the ones `Remote` leaves out. */
type Listener<Port> = {
  [K in keyof Port]: K extends `on${string}` ? K : never
}[keyof Port]

/** What one call of an `on…` operation's callback receives. */
type Delivery<Callback> = Callback extends (cb: (...args: infer A) => unknown) => unknown
  ? A
  : never

/** What an `on…` operation's callback returns, such as the snapshot a
 *  request handler answers with. */
type Answer<Callback> = Callback extends (cb: (...args: never[]) => infer R) => unknown
  ? R
  : never

/** Drives a port's `on…` operations from Node, where a callback can't go: the
 *  callback stays in the page. `record` subscribes and keeps every delivery,
 *  `delivered` reads them back in the order they came, and `answerWith`
 *  registers a callback that answers with a fixed value. Typed from the port,
 *  like `Remote`. */
export type Listeners<Port> = {
  record<K extends Listener<Port>>(operation: K): Promise<void>
  delivered<K extends Listener<Port>>(operation: K): Promise<Delivery<Port[K]>[]>
  answerWith<K extends Listener<Port>>(
    operation: K,
    value: Answer<Port[K]>,
  ): Promise<void>
}

type DeliveriesGlobal = {
  __deliveries?: WeakMap<object, Record<string, unknown[][]>>
}

/** The `Listeners` of an object that stays in the page, such as a session. */
export function listenersOf<Port>(handle: JSHandle<Port>): Listeners<Port> {
  return {
    async record(operation) {
      await handle.evaluate((target, name) => {
        const page = globalThis as unknown as DeliveriesGlobal
        page.__deliveries ??= new WeakMap()
        const byOperation = page.__deliveries.get(target as object) ?? {}
        page.__deliveries.set(target as object, byOperation)
        const deliveries: unknown[][] = []
        byOperation[name] = deliveries
        const subscribe = (target as Record<string, (cb: unknown) => unknown>)[name]
        if (typeof subscribe !== 'function') {
          throw new Error(`The session has no operation ${name}`)
        }
        subscribe.call(target, (...args: unknown[]) => {
          deliveries.push(args)
        })
      }, String(operation))
    },
    async delivered(operation) {
      return handle.evaluate((target, name) => {
        const page = globalThis as unknown as DeliveriesGlobal
        const deliveries = page.__deliveries?.get(target as object)?.[name]
        if (!deliveries) throw new Error(`${name} isn't being recorded`)
        return deliveries
      }, String(operation)) as never
    },
    async answerWith(operation, value) {
      await handle.evaluate(
        (target, [name, answer]) => {
          const subscribe = (target as Record<string, (cb: unknown) => unknown>)[name]
          if (typeof subscribe !== 'function') {
            throw new Error(`The session has no operation ${name}`)
          }
          subscribe.call(target, () => answer)
        },
        [String(operation), value] as const,
      )
    },
  }
}

/** Everything `window.__harness` holds, one entry per port. The harness page
 *  declares its global `satisfies Harness`, so a missing operation fails to
 *  compile on both sides. A port that is a function returning a session (the
 *  network's `JoinSession`) is installed as `{ join }`: the session it returns
 *  stays in the page, and steps reach it through a `JSHandle` (`remoteHandle`). */
export type Harness = {
  file: HarnessEntry<FileDownloadApi>
  sessionFiles: HarnessEntry<SessionFileApi>
  diagnostics: HarnessEntry<DiagnosticsLog>
  participantIdentity: HarnessEntry<ParticipantIdentityApi>
  network: { join: JoinSession }
}

type HarnessGlobal = {
  __harness?: Record<string, Record<string, (...args: unknown[]) => unknown> | undefined>
}

/** A Proxy that turns every property into an async operation forwarded by
 *  `call`, so no driver keeps a method list that could fall behind the port. */
function forwarder<Port>(
  call: (operation: string, args: unknown[]) => Promise<unknown>,
): Remote<Port> {
  return new Proxy(
    {},
    {
      get: (_target, method) =>
        // Not a thenable: `await`ing a driver must not look for a `then` operation.
        method === 'then'
          ? undefined
          : (...args: unknown[]) => call(String(method), args),
    },
  ) as Remote<Port>
}

/** A driver for the port behind `window.__harness[entry]`. Its type comes from
 *  the entry, so a driver can't be typed against another port. */
export function remote<Entry extends keyof Harness>(
  page: Page,
  entry: Entry,
): Remote<Harness[Entry]> {
  return forwarder<Harness[Entry]>((operation, args) =>
    page.evaluate(
      ([portEntry, portOperation, operationArgs]) => {
        const call = (globalThis as unknown as HarnessGlobal).__harness?.[portEntry]?.[
          portOperation
        ]
        if (!call) {
          throw new Error(
            `window.__harness.${portEntry}.${portOperation} is not installed: did the harness page load?`,
          )
        }
        return call(...operationArgs)
      },
      [entry, operation, args] as const,
    ),
  )
}

/** A driver for an object that stays in the page, such as the session
 *  `JoinSession` returns: every operation runs on the object the handle points
 *  to. Its type comes from the handle's, so it follows the port too. */
export function remoteHandle<Port>(handle: JSHandle<Port>): Remote<Port> {
  return forwarder<Port>((operation, args) =>
    handle.evaluate(
      (target, [portOperation, operationArgs]) => {
        const call = (target as Record<string, (...a: unknown[]) => unknown>)[
          portOperation
        ]
        if (typeof call !== 'function') {
          throw new Error(`The session has no operation ${portOperation}`)
        }
        return call.apply(target, operationArgs)
      },
      [operation, args] as const,
    ),
  )
}

/** Calls `window.__harness.network.join` in the page and keeps the session it
 *  returns there, handing Node a typed handle to it. */
export async function joinInPage(
  page: Page,
  ...args: Parameters<JoinSession>
): Promise<JSHandle<ReturnType<JoinSession>>> {
  return page.evaluateHandle((joinArgs) => {
    const join = (globalThis as unknown as HarnessGlobal).__harness?.network?.join
    if (!join) {
      throw new Error(
        'window.__harness.network.join is not installed: did the harness page load?',
      )
    }
    return join(...joinArgs) as ReturnType<JoinSession>
  }, args)
}
