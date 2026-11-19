import type { Page } from '@playwright/test'
import type { FileDownloadApi } from '../../../src/application/ports/outbound/fileDownload'

/** A port's operations: everything but its `on…` callbacks, which can't cross
 *  from the page into Node and are journalled by the harness instead. */
type Operations<Port> = {
  [K in keyof Port as K extends `on${string}` ? never : K]: Port[K]
}

/** What the harness installs for a port: the adapter's own operations. */
type HarnessEntry<Port> = Operations<Port>

/** A port as the steps see it from Node: every operation async, because each
 *  call is a round trip into the page. Derived from the port type, so a port
 *  change reaches every step through `pnpm typecheck`. */
export type Remote<Port> = {
  [K in keyof Operations<Port>]: Operations<Port>[K] extends (...args: infer A) => infer R
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
  __harness: Record<string, Record<string, (...args: unknown[]) => unknown>>
}

/** A driver for the port behind `window.__harness[entry]`: forwards any
 *  operation through `page.evaluate`, so no driver keeps a method list that
 *  could fall behind the port. */
export function remote<Port>(page: Page, entry: keyof Harness): Remote<Port> {
  return new Proxy(
    {},
    {
      get: (_target, method) =>
        // Not a thenable: `await`ing a driver must not look for a `then` operation.
        method === 'then'
          ? undefined
          : (...args: unknown[]) =>
              page.evaluate(
                ([portEntry, operation, operationArgs]) =>
                  (globalThis as unknown as HarnessGlobal).__harness[portEntry]![
                    operation
                  ]!(...operationArgs),
                [entry, String(method), args] as const,
              ),
    },
  ) as Remote<Port>
}
