import { defineConfig } from 'steiger'
import fsd from '@feature-sliced/steiger-plugin'

// See docs/adr/004-feature-sliced-design-architecture.md for the adopted layer
// set (app/pages/widgets/features/entities/shared) and the rationale for
// enforcing it with Steiger rather than duplicating boundary rules in oxlint.
export default defineConfig([...fsd.configs.recommended])
