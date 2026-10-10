#!/bin/sh
# PreToolUse hard block (deterministic, outside model judgment): deny Edit/Write
# outside the repo's approved paths, and any edit to nocturne.css — a verbatim,
# unmodified port of the Nocturne design system (see AGENTS.md). Everything else
# (lint, size/complexity rules, architecture boundaries) is enforced by scanners,
# not here — see docs/adr/004-feature-sliced-design-architecture.md and
# docs/adr/009-architecture-style-fsd-vs-hexagonal-core.md.
set -eu

input=$(cat)
file_path=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty')

[ -z "$file_path" ] && { echo '{}'; exit 0; }

deny() {
  reason="$1"
  printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":%s}}' \
    "$(printf '%s' "$reason" | jq -Rs .)"
  exit 0
}

root="${CLAUDE_PROJECT_DIR:-$PWD}"

case "$file_path" in
  "$root"/src/design/nocturne.css)
    deny "Blocked: src/design/nocturne.css is a verbatim, unmodified port of the Nocturne design system (see AGENTS.md) — add app-specific styling in its own file instead."
    ;;
esac

case "$file_path" in
  "$root"/src/*|"$root"/docs/*|"$root"/.claude/*|"$root"/.github/*|"$root"/public/*|"$root"/e2e/*|"$root"/scripts/*|"$HOME"/obsidian/AgileDojo/0-Inbox/*) echo '{}'; exit 0 ;;
  "$HOME"/.claude/*) echo '{}'; exit 0 ;;
  "$root"/package.json|"$root"/pnpm-lock.yaml|"$root"/tsconfig*.json|"$root"/vite.config.ts \
    |"$root"/.oxlintrc.json|"$root"/.prettierrc.json|"$root"/.prettierignore|"$root"/knip.json \
    |"$root"/steiger.config.ts|"$root"/.oxlintrc.metrics.json|"$root"/index.html \
    |"$root"/README.md|"$root"/AGENTS.md|"$root"/CHANGELOG.md|"$root"/LICENSE \
    |"$root"/.gitignore|"$root"/.mcp.json|"$root"/playwright.config.ts)
    echo '{}'; exit 0 ;;
esac

deny "Blocked: writes are limited to src/, docs/, scripts/, .claude/, .github/, and known root config files in this repo (see .claude/hooks/pretooluse-guard.sh). If this path should be writable, update the guardrails hook rather than working around it."
