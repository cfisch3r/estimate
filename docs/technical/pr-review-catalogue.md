# PR review catalogue

The named categories of change that deserve a closer look when reviewing a branch, and the minimum risk
each one carries. Each category has a short name so that a review guide, a review or a discussion
can cite it ("this is `wire-contract`"). The words follow the [glossary](../glossary.md).
"PR" in the name means a pull request's branch: what is reviewed is that branch with any
uncommitted changes, also before the pull request is opened.

## Plugin manual

How the floor, the Review guide and its changeset map work is described in the Review guide
plugin's [manual](../../.claude/skills/pr-review-guide/docs/README.md).

## Catalogue data

The one fenced `yaml` block in this file is the data the floor script reads. Its fields are described in the plugin's
[catalogue format](../../.claude/skills/pr-review-guide/docs/catalogue-format.md#catalogue-data).

```yaml
- name: domain-math
  min-risk: high
  paths: ['src/domain/**']
  diff-checks: []

- name: live-session-state
  min-risk: high
  paths:
    - 'src/application/stores/**'
    - 'src/application/useCases/**'
    - 'src/application/ports/**'
    - 'src/adapters/network/session*.ts'
    - 'src/adapters/network/connection*.ts'
    - 'src/adapters/network/signaling.ts'
    - 'src/adapters/network/signaling.wsRelay.ts'
  diff-checks: []

- name: wire-contract
  min-risk: high
  paths:
    - 'src/adapters/network/wireParse*.ts'
    - 'src/adapters/network/actions*.ts'
    - 'src/adapters/network/signalingContract.ts'
    - 'src/domain/snapshot*.ts'
  diff-checks: []

- name: guardrail-weakened
  min-risk: high
  paths:
    - 'tsconfig*.json'
    - 'vite.config.ts'
    - 'vite.harness.config.ts'
    - 'playwright.config.ts'
    - '.oxlintrc*.json'
    - 'steiger.config.ts'
    - '.dependency-cruiser.cjs'
    - '.dependency-cruiser.specs.cjs'
    - 'scripts/noPendingSpecs.mjs'
    - 'scripts/noPendingSpecs.test.ts'
    - 'knip.json'
    - '.prettierrc.json'
    - 'src/design/nocturne.css'
    - 'src/viMockPaths.test.ts'
    - 'scripts/layerRules.test.ts'
    - 'scripts/specRules.test.ts'
    - 'AGENTS.md'
    - '.claude/hooks/**'
    - '.claude/settings.json'
    - '.claude/skills/**'
    - '.githooks/**'
    - 'docs/technical/architecture-rules.md'
    - 'docs/technical/pr-review-catalogue.md'
    - 'pr-review-guide.yaml'
    - '.worktreeinclude'
  diff-checks: [coverageThresholdLowered, testsRemovedOrSkipped, strictnessLoosened, architectureExceptionAdded]

- name: release-and-deploy
  min-risk: high
  paths:
    - '.github/workflows/**'
    - '.github/actions/**'
    - 'release-please-config.json'
    - '.release-please-manifest.json'
    - 'docs/technical/runbook.md'
  diff-checks: []

- name: dependencies
  min-risk: medium
  paths: ['pnpm-lock.yaml']
  diff-checks: [dependencyFieldsChanged]

- name: mechanical
  min-risk: low
  fallback: true
  paths: ['docs/**', '**/*.md']
  diff-checks: [pureRename]
```

## Why each category exists

| Category | Why it matters here |
|---|---|
| `domain-math` | The estimation rules (aggregation, the `Estimate` invariant, bias guards) produce plausible numbers when they are wrong. Nothing crashes, and the domain keeps 100% coverage so a gap in tests is itself a warning sign (`pure-domain`). |
| `live-session-state` | Who owns the round, what a reconnect restores and when a submission is acknowledged are easy to break without a visible error. They follow [ADR-003](adr/003-session-reliability-model.md) and the store split in [ADR-005](adr/005-session-store-decomposition.md). The category covers the stores, the use cases, the ports and the adapters that hold per-connection state. |
| `wire-contract` | Peers may run different builds, so a change to what is sent or accepted between them must stay compatible. This is the repository's one-way door: once a build is out, its messages cannot be recalled. It covers peer message parsing, the action definitions, the signaling contract and the session snapshot that the facilitator sends. The snapshot files are in `src/domain`, so they match `domain-math` as well. |
| `guardrail-weakened` | A change that loosens a check makes every later change less safe: type strictness, lint and architecture rules, coverage thresholds, removed or skipped tests, the verbatim design-system stylesheet, and the instructions and hooks that guide the agents. The catalogue, the settings file `pr-review-guide.yaml` that names it, and the architecture rules are in this category too, so a change cannot lower its own floor without being flagged. |
| `release-and-deploy` | Merging to `main` ships to production. Workflows, release configuration and the runbook decide what ships and how. |
| `dependencies` | Supply chain, bundle size and behaviour drift. Any change to the lockfile or to the dependency fields of `package.json` counts; the version bump of the package itself, written by the release tooling, does not. |
| `mechanical` | Documentation changes and pure renames. Skim only. |

## Changing the catalogue

How a change to the catalogue takes effect is described in the plugin's
[Changing the catalogue](../../.claude/skills/pr-review-guide/docs/catalogue-format.md#changing-the-catalogue):
in a pull request with the reason, and for later pull requests only.

A change to this file or to `pr-review-guide.yaml` is `guardrail-weakened` by rule, because this
file's YAML block lists both paths.

Keep the prose in "Why each category exists" and the YAML block in step with each other; the block
is the only place that lists paths, so nothing else has to be updated.
