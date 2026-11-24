import type { JSHandle, Page } from '@playwright/test'
import type { DiagnosticsLog } from '../../../src/application/ports/outbound/diagnosticsLog'
import type { FileDownloadApi } from '../../../src/application/ports/outbound/fileDownload'
import type { JoinSession } from '../../../src/application/ports/outbound/networkTransport'
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

/** Everything `window.__harness` holds, one entry per port. The harness page
 *  declares its global `satisfies Harness`, so a missing operation fails to
 *  compile on both sides. A port that is a function returning a session (the
 *  network's `JoinSession`) is installed as `{ join }`: the session it returns
 *  stays in the page, and steps reach it through a `JSHandle` (`remoteHandle`). */
export type Harness = {
  file: HarnessEntry<FileDownloadApi>
  sessionFiles: HarnessEntry<SessionFileApi>
  diagnostics: HarnessEntry<DiagnosticsLog>
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
