import { useCallback, useState } from 'react'

/** Keeps at most one info popover open per screen, keyed by group name — the
 *  shared open/closed UI state the workspace redesign calls for
 *  ('estimate' | 'phase' | 'range' | ... | null). */
export function useSingleInfoPopover<K extends string>() {
  const [openKey, setOpenKey] = useState<K | null>(null)
  const open = useCallback((key: K) => setOpenKey(key), [])
  const close = useCallback(() => setOpenKey(null), [])
  return { openKey, open, close }
}
