import { createContext, useContext } from 'react'
import type { FileDownloadApi } from './outbound/fileDownload'

/** Provides the file-download port (`./outbound/fileDownload`) to the save use case. */

export const FileDownloadContext = createContext<FileDownloadApi | null>(null)

export function useFileDownload(): FileDownloadApi {
  const api = useContext(FileDownloadContext)
  if (api === null) {
    throw new Error('useFileDownload must be used within a FileDownloadContext provider')
  }
  return api
}
