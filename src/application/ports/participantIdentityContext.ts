import { createContext, useContext } from 'react'
import type { ParticipantIdentityApi } from './outbound/participantIdentity'

/** Provides the participant-identity port (`./outbound/participantIdentity`) to the join use case. */

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
