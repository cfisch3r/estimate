/// <reference types="vite/client" />

declare const __APP_VERSION__: string

interface ImportMetaEnv {
  /** Only read by `signaling.wsRelay.ts`, the `--mode e2e` build's aliased
   *  signaling module — never present in a production build. See ADR-007. */
  readonly VITE_TRYSTERO_RELAY_URL?: string
}
