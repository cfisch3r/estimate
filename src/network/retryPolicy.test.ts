import { describe, expect, it, vi } from 'vitest'
import { withKindDrivenRetry } from './retryPolicy'

function kindError(kind: string) {
  return Object.assign(new Error(kind), { kind })
}

describe('withKindDrivenRetry', () => {
  it('resolves on the first attempt without retrying', async () => {
    const attempt = vi.fn().mockResolvedValue('ok')

    const result = await withKindDrivenRetry(attempt, { delay: vi.fn() })

    expect(result).toBe('ok')
    expect(attempt).toHaveBeenCalledTimes(1)
  })

  it('retries a timeout failure up to the configured limit, then surfaces it', async () => {
    const attempt = vi.fn().mockRejectedValue(kindError('timeout'))
    const delay = vi.fn().mockResolvedValue(undefined)

    await expect(
      withKindDrivenRetry(attempt, { retries: 2, backoffMs: [500, 1500], delay }),
    ).rejects.toMatchObject({ kind: 'timeout' })

    expect(attempt).toHaveBeenCalledTimes(3)
    expect(delay).toHaveBeenNthCalledWith(1, 500)
    expect(delay).toHaveBeenNthCalledWith(2, 1500)
  })

  it('recovers if a retried attempt eventually succeeds', async () => {
    const attempt = vi
      .fn()
      .mockRejectedValueOnce(kindError('timeout'))
      .mockResolvedValueOnce('recovered')
    const delay = vi.fn().mockResolvedValue(undefined)

    const result = await withKindDrivenRetry(attempt, { delay })

    expect(result).toBe('recovered')
    expect(attempt).toHaveBeenCalledTimes(2)
  })

  it('does not retry a disconnected failure', async () => {
    const error = kindError('disconnected')
    const attempt = vi.fn().mockRejectedValue(error)
    const delay = vi.fn()

    await expect(withKindDrivenRetry(attempt, { delay })).rejects.toBe(error)
    expect(attempt).toHaveBeenCalledTimes(1)
    expect(delay).not.toHaveBeenCalled()
  })

  it('does not retry an aborted failure', async () => {
    const error = kindError('aborted')
    const attempt = vi.fn().mockRejectedValue(error)

    await expect(withKindDrivenRetry(attempt, { delay: vi.fn() })).rejects.toBe(error)
    expect(attempt).toHaveBeenCalledTimes(1)
  })

  it('surfaces a generic (non-timeout) failure after a single attempt', async () => {
    const error = new Error('handler threw')
    const attempt = vi.fn().mockRejectedValue(error)

    await expect(withKindDrivenRetry(attempt, { delay: vi.fn() })).rejects.toBe(error)
    expect(attempt).toHaveBeenCalledTimes(1)
  })
})
