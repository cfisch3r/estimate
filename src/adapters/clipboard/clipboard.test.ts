import { afterEach, describe, expect, it, vi } from 'vitest'
import { writeClipboardText } from './clipboard'

afterEach(() => vi.unstubAllGlobals())

describe('writeClipboardText', () => {
  it("puts the text on the browser's clipboard", async () => {
    const writeText = vi.fn(() => Promise.resolve())
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    await writeClipboardText('report')

    expect(writeText).toHaveBeenCalledTimes(1)
    expect(writeText).toHaveBeenCalledWith('report')
  })

  it('rejects when the browser has no clipboard', async () => {
    vi.stubGlobal('navigator', {})
    await expect(writeClipboardText('report')).rejects.toThrow(/clipboard/i)
  })
})
