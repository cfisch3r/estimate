import { defineConfig } from 'steiger'
import fsd from '@feature-sliced/steiger-plugin'

// See docs/adr/004-feature-sliced-design-architecture.md for the adopted layer
// set (app/pages/widgets/features/entities/shared) and the rationale for
// enforcing it with Steiger rather than duplicating boundary rules in oxlint.
export default defineConfig([
  ...fsd.configs.recommended,
  // Cross-imports between sibling entities go through FSD's `@x` notation
  // (e.g. `entities/estimate/@x/session.ts`, the surface `entities/session`
  // may use) rather than a rule exemption, so each coupling is explicit,
  // narrow and reviewable in one file per consumer.
  {
    // `features/reveal-results` has one consumer today (pages/workspace) — kept
    // as its own feature rather than folded into the page because it's a named,
    // growing use case (facilitator reveal/retry), not incidental UI, per
    // ADR-004. `entities/participant` has one direct consumer
    // (pages/participant-estimate; entities/session reaches it only through its
    // `@x` surface, which Steiger does not count) for the same reason it's a
    // real, separately-testable domain noun, not incidental code.
    // `features/submit-estimate` has one consumer
    // (pages/participant-estimate) for the same reason: it's the participant's
    // submit use case, kept out of `estimate-round`, which is form UI shared by
    // both roles. Revisit any of them if they never gain a second consumer.
    files: [
      './src/features/reveal-results/**',
      './src/features/submit-estimate/**',
      './src/entities/participant/**',
    ],
    rules: {
      'fsd/insignificant-slice': 'off',
    },
  },
])
