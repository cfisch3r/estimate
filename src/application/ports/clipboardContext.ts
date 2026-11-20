import { createContext, useContext } from 'react'
import type { ClipboardApi } from './outbound/clipboard'

/** Provides the clipboard port (`./outbound/clipboard`) to the diagnosis use case. */
export const ClipboardContext = createContext<ClipboardApi | null>(null)

export function useClipboard(): ClipboardApi {
  const api = useContext(ClipboardContext)
  if (api === null) {
    throw new Error('useClipboard must be used within a ClipboardContext provider')
  }
  return api
}
