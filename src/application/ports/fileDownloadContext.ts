import { createContext, useContext } from 'react'

/** The port through which the save use case hands a finished file to the
 *  user. The file adapter implements it; `app/` provides it. */
export interface FileDownloadApi {
  download: (fileName: string, text: string) => void
}

export const FileDownloadContext = createContext<FileDownloadApi | null>(null)

export function useFileDownload(): FileDownloadApi {
  const api = useContext(FileDownloadContext)
  if (api === null) {
    throw new Error('useFileDownload must be used within a FileDownloadContext provider')
  }
  return api
}
