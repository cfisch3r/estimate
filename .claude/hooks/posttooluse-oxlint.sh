#!/bin/sh
# PostToolUse: fast, per-file oxlint on the file Claude just edited. Surfaces
# output only — never blocks — so Claude can self-correct mid-task. Whole-project
# checks (typecheck, architecture boundaries, dead code, tests) run once per turn
# in the Stop hook instead, since running them per-edit would fire on expected
# transient intermediate states (e.g. a file created before its consumer exists).
set -eu

input=$(cat)
file_path=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty')

case "$file_path" in
  *.ts|*.tsx) ;;
  *) echo '{}'; exit 0 ;;
esac

root="${CLAUDE_PROJECT_DIR:-$PWD}"
case "$file_path" in
  "$root"/src/*) ;;
  *) echo '{}'; exit 0 ;;
esac

cd "$root"
output=$(npx oxlint "$file_path" 2>&1) || true

if [ -n "$output" ]; then
  printf '{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":%s}}' \
    "$(printf '%s' "$output" | jq -Rs .)"
else
  echo '{}'
fi
