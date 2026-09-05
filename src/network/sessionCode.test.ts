import { describe, expect, it } from 'vitest'
import { generateSessionCode } from './sessionCode'

describe('generateSessionCode', () => {
  it('returns a 6-character code', () => {
    expect(generateSessionCode()).toHaveLength(6)
  })

  it('only uses unambiguous base32 characters', () => {
    for (let i = 0; i < 200; i++) {
      expect(generateSessionCode()).toMatch(/^[2-9A-HJKMNP-TV-Z]{6}$/)
    }
  })

  it('never emits the ambiguous glyphs 0, O, 1, I or L', () => {
    const joined = Array.from({ length: 500 }, generateSessionCode).join('')
    expect(joined).not.toMatch(/[01OIL]/)
  })

  it('is practically unique across many calls', () => {
    const codes = new Set(Array.from({ length: 1000 }, generateSessionCode))
    expect(codes.size).toBeGreaterThan(990)
  })
})
