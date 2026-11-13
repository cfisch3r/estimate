import { afterEach, describe, expect, it, vi } from 'vitest'
import { downloadTextFile } from './fileDownload'

describe('downloadTextFile', () => {
  afterEach(() => vi.restoreAllMocks())

  it('clicks a download link for a JSON blob and releases its URL', async () => {
    // jsdom has no object URLs, so stand them in.
    const createObjectURL = vi.fn((_blob: Blob) => 'blob:session')
    const revokeObjectURL = vi.fn()
    Object.assign(URL, { createObjectURL, revokeObjectURL })
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        expect(this.download).toBe('s.estimate.json')
        expect(this.href).toBe('blob:session')
      })

    downloadTextFile('s.estimate.json', '{"version":1}')

    expect(click).toHaveBeenCalledTimes(1)
    const blob = createObjectURL.mock.calls[0]?.[0]
    expect(blob?.type).toBe('application/json')
    expect(await blob?.text()).toBe('{"version":1}')
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:session')
  })
})
