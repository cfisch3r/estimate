import { defineConfig } from 'steiger'
import fsd from '@feature-sliced/steiger-plugin'

// See docs/adr/004-feature-sliced-design-architecture.md for the adopted layer
// set (app/pages/widgets/features/entities/shared) and the rationale for
// enforcing it with Steiger rather than duplicating boundary rules in oxlint.
export default defineConfig([
  ...fsd.configs.recommended,
  {
    // `features/submit-estimate` has one consumer (pages/participant-estimate):
    // it's the participant's submit use case, kept out of `estimate-round`,
    // which is form UI shared by both roles, as a named, separately-testable
    // use case rather than incidental page code. Revisit if it never gains a
    // second consumer.
    files: ['./src/features/submit-estimate/**'],
    rules: {
      'fsd/insignificant-slice': 'off',
    },
  },
])
