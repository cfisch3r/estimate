/** The browser clipboard, for the clipboard port. Rejects, rather than throws,
 *  where the browser has no Clipboard API (an insecure context, for example),
 *  so callers handle one failure path. */
export function writeClipboardText(text: string): Promise<void> {
  const clipboard = globalThis.navigator?.clipboard
  if (!clipboard) return Promise.reject(new Error('This browser offers no clipboard'))
  return clipboard.writeText(text)
}
