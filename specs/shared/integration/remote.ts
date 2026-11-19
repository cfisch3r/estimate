import type { Page } from '@playwright/test'
import type { FileDownloadApi } from '../../../src/application/ports/outbound/fileDownload'

/** What the harness installs for a port: the adapter's own operations, without
 *  the port's `on…` callbacks, which can't cross from the page into Node and are
 *  journalled by the harness instead. */
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
 *  compile on both sides. */
export type Harness = {
  file: HarnessEntry<FileDownloadApi>
}

type HarnessGlobal = {
  __harness?: Record<string, Record<string, (...args: unknown[]) => unknown> | undefined>
}

/** A driver for the port behind `window.__harness[entry]`. Its type comes from
 *  the entry, so a driver can't be typed against another port. It forwards any
 *  operation through `page.evaluate`, so no driver keeps a method list that
 *  could fall behind the port. */
export function remote<Entry extends keyof Harness>(
  page: Page,
  entry: Entry,
): Remote<Harness[Entry]> {
  return new Proxy(
    {},
    {
      get: (_target, method) =>
        // Not a thenable: `await`ing a driver must not look for a `then` operation.
        method === 'then'
          ? undefined
          : (...args: unknown[]) =>
              page.evaluate(
                ([portEntry, operation, operationArgs]) => {
                  const call = (globalThis as unknown as HarnessGlobal).__harness?.[
                    portEntry
                  ]?.[operation]
                  if (!call) {
                    throw new Error(
                      `window.__harness.${portEntry}.${operation} is not installed: did the harness page load?`,
                    )
                  }
                  return call(...operationArgs)
                },
                [entry, String(method), args] as const,
              ),
    },
  ) as Remote<Harness[Entry]>
}
