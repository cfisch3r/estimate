import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { DiagnosticEntry } from '../../domain/diagnosis/types'
import { ClipboardContext } from '../ports/clipboardContext'
import { DiagnosticsLogContext } from '../ports/diagnosticsLogContext'
import { FileDownloadContext } from '../ports/fileDownloadContext'
import type { ClipboardApi } from '../ports/outbound/clipboard'
import type { DiagnosticsLog } from '../ports/outbound/diagnosticsLog'
import { useDiagnosisReport } from './useDiagnosisReport'

const ENTRY: DiagnosticEntry = {
  kind: 'status',
  status: 'connected',
  at: '2026-11-20T09:30:00.000Z',
  tab: 'ab12',
}

let entries: DiagnosticEntry[]
let available: boolean
const log: DiagnosticsLog = {
  record: vi.fn(),
  read: () => ({ available, entries, userAgent: 'Mozilla/5.0 Firefox/133.0' }),
  clear: vi.fn(() => {
    entries = []
  }),
}
const download = vi.fn()
const clipboard: ClipboardApi = { writeText: vi.fn(() => Promise.resolve()) }

function wrapper({ children }: { children: ReactNode }) {
  return (
    <DiagnosticsLogContext.Provider value={log}>
      <FileDownloadContext.Provider value={{ download }}>
        <ClipboardContext.Provider value={clipboard}>
          {children}
        </ClipboardContext.Provider>
      </FileDownloadContext.Provider>
    </DiagnosticsLogContext.Provider>
  )
}

const render = () => renderHook(() => useDiagnosisReport('0.9.0'), { wrapper })

beforeEach(() => {
  entries = [ENTRY]
  available = true
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 20, 9, 35))
})
afterEach(() => vi.useRealTimers())

describe('useDiagnosisReport', () => {
  it('shows the formatted report of what the log holds', () => {
    const { result } = render()

    expect(result.current.available).toBe(true)
    expect(result.current.report).toContain('App version: 0.9.0')
    expect(result.current.report).toContain('Browser: Firefox 133')
    expect(result.current.report).toContain('[ab12] status  connected')
  })

  it('says when recording is unavailable', () => {
    available = false
    expect(render().result.current.available).toBe(false)
  })

  it('downloads the report as a dated text file', () => {
    const { result } = render()

    act(() => result.current.download())

    expect(download).toHaveBeenCalledTimes(1)
    expect(download).toHaveBeenCalledWith(
      'estimate-diagnosis-2026-11-20-0935.txt',
      result.current.report,
      'text/plain',
    )
  })

  it('copies the report and says so', async () => {
    const { result } = render()

    let outcome: string | undefined
    await act(async () => {
      outcome = await result.current.copy()
    })

    expect(clipboard.writeText).toHaveBeenCalledWith(result.current.report)
    expect(outcome).toBe('copied')
  })

  it('says when copying failed', async () => {
    vi.mocked(clipboard.writeText).mockRejectedValueOnce(new Error('denied'))
    const { result } = render()

    let outcome: string | undefined
    await act(async () => {
      outcome = await result.current.copy()
    })

    expect(outcome).toBe('failed')
  })

  it('clears the log and shows the emptied report', () => {
    const { result } = render()

    act(() => result.current.clear())

    expect(log.clear).toHaveBeenCalledTimes(1)
    expect(result.current.report).toContain('No connection events recorded.')
  })
})
