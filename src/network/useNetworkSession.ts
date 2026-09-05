import { useContext } from 'react'
import { NetworkSessionContext, type NetworkSessionApi } from './networkSessionContext'

export function useNetworkSession(): NetworkSessionApi {
  const api = useContext(NetworkSessionContext)
  if (api === null) {
    throw new Error('useNetworkSession must be used within a NetworkProvider')
  }
  return api
}
