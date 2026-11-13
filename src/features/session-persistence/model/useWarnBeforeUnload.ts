import { useEffect } from 'react'
import { useHasUnsavedChanges } from '../../../application'

/** While the session holds unsaved changes, closing or reloading the tab
 *  raises the browser's own leave-page warning. Mounted once, app-wide. */
export function useWarnBeforeUnload(): void {
  const unsaved = useHasUnsavedChanges()

  useEffect(() => {
    if (!unsaved) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      // Older browsers show the warning only when returnValue is set.
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [unsaved])
}
