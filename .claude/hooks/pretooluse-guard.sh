#!/bin/sh
# PreToolUse hard block (deterministic, outside model judgment): deny Edit/Write
# outside the repo, and any edit to nocturne.css — a verbatim,
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
  */../*|*/..)
    deny "Blocked: $file_path contains '..'. Use the absolute path."
    ;;
  "$root"/.git/*|*/node_modules/*|*/.env|*/.env.*)
    deny "Blocked: $file_path is not something to edit by hand (.git, .env files, node_modules)."
    ;;
  "$root"/*|"$HOME"/.claude/*|"$HOME"/obsidian/AgileDojo/0-Inbox/*|/private/tmp/claude-*/*)
    echo '{}'; exit 0 ;;
esac

deny "Blocked: writes are limited to this repo, ~/.claude, the Obsidian inbox and the Claude scratchpad (see .claude/hooks/pretooluse-guard.sh)."
