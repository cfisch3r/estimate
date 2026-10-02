import { defineConfig } from 'steiger'
import fsd from '@feature-sliced/steiger-plugin'

// See docs/adr/004-feature-sliced-design-architecture.md for the adopted layer
// set (app/pages/widgets/features/entities/shared) and the rationale for
// enforcing it with Steiger rather than duplicating boundary rules in oxlint.
export default defineConfig([
  ...fsd.configs.recommended,
  {
    // `entities/session/{model,api}` (the parked, not-yet-decomposed
    // state/store.ts and the network wire layer — see ADR-004) genuinely
    // depends on `entities/estimate` (Estimate validation/aggregation) and
    // `entities/participant` (participant identity): a live round's Item
    // holds Estimate submissions, and store actions validate through
    // createEstimate(). This is real domain coupling, not accidental
    // layering — revisit when issue #111 (store decomposition) lands, since
    // splitting the store may reduce or relocate this dependency. Scoped to
    // model/api only (not ui/lib, which have no such dependency today) so an
    // accidental cross-slice import elsewhere in entities/session still fails.
    files: ['./src/entities/session/model/**', './src/entities/session/api/**'],
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
    // noun, not incidental code. `features/submit-estimate` has one consumer
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
