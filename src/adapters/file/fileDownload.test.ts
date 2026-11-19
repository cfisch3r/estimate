import { afterEach, describe, expect, it, vi } from 'vitest'
import { downloadTextFile } from './fileDownload'

describe('downloadTextFile', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('clicks a download link for a blob of the given type and releases its URL later', async () => {
    vi.useFakeTimers()
    // jsdom has no object URLs, so stand them in.
    const createObjectURL = vi.fn((_blob: Blob) => 'blob:session')
    const revokeObjectURL = vi.fn()
    Object.assign(URL, { createObjectURL, revokeObjectURL })
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        expect(this.download).toBe('r.txt')
        expect(this.href).toBe('blob:session')
      })

    downloadTextFile('r.txt', 'line ✓', 'text/plain')

    expect(click).toHaveBeenCalledTimes(1)
    const blob = createObjectURL.mock.calls[0]?.[0]
    expect(blob?.type).toBe('text/plain')
    expect(await blob?.text()).toBe('line ✓')
    // Not at once: the download may start only after click() returns.
    expect(revokeObjectURL).not.toHaveBeenCalled()
    vi.advanceTimersByTime(60_000)
    expect(revokeObjectURL).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:session')
  })
})
