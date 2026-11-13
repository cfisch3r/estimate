import { useRef, useState } from 'react'
import type { ChangeEvent, InputHTMLAttributes, RefObject } from 'react'
import { useDiscardSession, useLoadSessionFile } from '../../../application'

/** A file that was picked and rejected, with the reason it can't be loaded. */
export type LoadRejection = { fileName: string; reason: string }

/** Load a session file on mode selection: `chooseFile` opens the browser's file
 *  picker through a hidden input the page renders with `fileInputProps`. A
 *  file that loads becomes the session; one that doesn't leaves it untouched
 *  and is reported in `rejection`. */
export function useSessionFileLoader(): {
  chooseFile: () => void
  fileInputProps: InputHTMLAttributes<HTMLInputElement> & {
    ref: RefObject<HTMLInputElement | null>
  }
  loadedFileName: string | null
  rejection: LoadRejection | null
  discard: () => void
} {
  const load = useLoadSessionFile()
  const discardSession = useDiscardSession()
  const inputRef = useRef<HTMLInputElement>(null)
  const [loadedFileName, setLoadedFileName] = useState<string | null>(null)
  const [rejection, setRejection] = useState<LoadRejection | null>(null)

  async function onChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const file = input.files?.[0]
    // Cleared so picking the same file again (after fixing it) fires again.
    input.value = ''
    if (!file) return
    const result = load(await file.text())
    if (result.ok) {
      setLoadedFileName(file.name)
      setRejection(null)
    } else {
      setRejection({ fileName: file.name, reason: result.error })
    }
  }

  return {
    chooseFile: () => inputRef.current?.click(),
    fileInputProps: {
      ref: inputRef,
      type: 'file',
      accept: '.json,application/json',
      hidden: true,
      onChange: (event) => void onChange(event),
    },
    loadedFileName,
    rejection,
    discard: () => {
      discardSession()
      setLoadedFileName(null)
    },
  }
}
