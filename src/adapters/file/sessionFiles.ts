import type { SessionFileApi } from '../../application/ports/outbound/sessionFiles'

/** The session-file adapter. A placeholder until #246 is implemented: the
 *  failing integration specs drive it through the harness. */
export const sessionFiles: SessionFileApi = {
  save: () => {
    throw new Error('Not implemented yet (#246)')
  },
  open: () => Promise.reject(new Error('Not implemented yet (#246)')),
}
