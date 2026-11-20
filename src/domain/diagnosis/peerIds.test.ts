import { describe, expect, it } from 'vitest'
import { shortPeerId, shortenPeerIdsIn } from './peerIds'

describe('shortPeerId', () => {
  it('keeps the first 6 characters', () => {
    expect(shortPeerId('abcdefghijklmnop')).toBe('abcdef')
  })

  it('leaves an id of 6 characters or fewer as it is', () => {
    expect(shortPeerId('abc')).toBe('abc')
  })
})

describe('shortenPeerIdsIn', () => {
  it('shortens every occurrence of each peer id in a text', () => {
    expect(
      shortenPeerIdsIn(
        'incorrect password (abcdefghij), retry abcdefghij from xyz1234567',
        ['abcdefghij', 'xyz1234567'],
      ),
    ).toBe('incorrect password (abcdef), retry abcdef from xyz123')
  })

  it('leaves the text alone when it names no peer id', () => {
    expect(shortenPeerIdsIn('handshake timed out', ['abcdefghij'])).toBe(
      'handshake timed out',
    )
  })

  it('ignores empty peer ids', () => {
    expect(shortenPeerIdsIn('handshake timed out', [''])).toBe('handshake timed out')
  })
})
