import { useContext } from 'react'
import { LiveSessionContext, type LiveSessionApi } from './liveSessionContext'

export function useLiveSession(): LiveSessionApi {
  const api = useContext(LiveSessionContext)
  if (api === null) {
    throw new Error('useLiveSession must be used within a LiveSessionProvider')
  }
  return api
}
