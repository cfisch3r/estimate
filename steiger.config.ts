import { defineConfig } from 'steiger'
import fsd from '@feature-sliced/steiger-plugin'

// See docs/adr/004-feature-sliced-design-architecture.md for the adopted layer
// set (app/pages/widgets/features/entities/shared) and the rationale for
// enforcing it with Steiger rather than duplicating boundary rules in oxlint.
export default defineConfig([
  ...fsd.configs.recommended,
  {
    // `entities/session` (the parked, not-yet-decomposed state/store.ts and the
    // network wire layer — see ADR-004) genuinely depends on `entities/estimate`
    // (Estimate validation/aggregation) and `entities/participant` (participant
    // identity): a live round's Item holds Estimate submissions, and store
    // actions validate through createEstimate(). This is real domain coupling,
    // not accidental layering — revisit when issue #111 (store decomposition)
    // lands, since splitting the store may reduce or relocate this dependency.
    files: ['./src/entities/session/**'],
    rules: {
      'fsd/forbidden-imports': 'off',
    },
  },
  {
    // `features/reveal-results` has one consumer today (pages/workspace) — kept
    // as its own feature rather than folded into the page because it's a named,
    // growing use case (facilitator reveal/retry), not incidental UI, per
    // ADR-004. `entities/participant` has one consumer (entities/session's
    // store) for the same reason it's a real, separately-testable domain
    // noun, not incidental code. Revisit either if it never gains a second
    // consumer.
    files: ['./src/features/reveal-results/**', './src/entities/participant/**'],
    rules: {
      'fsd/insignificant-slice': 'off',
    },
  },
])
