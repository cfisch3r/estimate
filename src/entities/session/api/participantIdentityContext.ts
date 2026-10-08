import { createContext, useContext } from 'react'

/** The port through which the join use case obtains this client's stable id
 *  (ADR-003). The storage adapter implements it; `app/` provides it. */
export interface ParticipantIdentityApi {
  getOrCreateParticipantId: () => string
}

export const ParticipantIdentityContext = createContext<ParticipantIdentityApi | null>(
  null,
)

export function useParticipantIdentity(): ParticipantIdentityApi {
  const api = useContext(ParticipantIdentityContext)
  if (api === null) {
    throw new Error(
      'useParticipantIdentity must be used within a ParticipantIdentityContext provider',
    )
  }
  return api
}
