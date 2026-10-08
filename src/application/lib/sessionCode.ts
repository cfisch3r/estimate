// Crockford base32 minus the ambiguous glyphs (0/O, 1/I/L) so a code that is
// read aloud or copied by hand round-trips cleanly.
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ'
const CODE_LENGTH = 6

// Largest multiple of ALPHABET.length that fits in a byte; bytes at or above it
// are rejected so every letter is equally likely (no modulo bias).
const REJECT_THRESHOLD = Math.floor(256 / ALPHABET.length) * ALPHABET.length

/** A short, shareable session code that doubles as the Trystero room id. */
export function generateSessionCode(): string {
  const buffer = new Uint8Array(1)
  let code = ''
  while (code.length < CODE_LENGTH) {
    crypto.getRandomValues(buffer)
    const byte = buffer[0]!
    if (byte < REJECT_THRESHOLD) {
      code += ALPHABET.charAt(byte % ALPHABET.length)
    }
  }
  return code
}
