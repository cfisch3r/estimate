#!/bin/sh
# PostToolUse on Bash: after `gh pr create` printed a pull request URL, run the floor script
# and show the minimum risk and the matched categories to the user as a harness message, so
# the report does not depend on what Claude writes. Never blocks; any failure stays silent.
set -eu

input=$(cat)
command=$(printf '%s' "$input" | jq -r '.tool_input.command // empty')

# The command itself must be `gh pr create`: at the start of a line or after ; & | (, not just
# mentioned in a heredoc or an echo.
printf '%s' "$command" | grep -qE '(^|[;&|(])[[:space:]]*gh pr create([[:space:]]|$)' ||
  { echo '{}'; exit 0; }

# Only after a successful create: its output holds the new pull request's URL.
printf '%s' "$input" | jq -r '.tool_response | if type == "object" then (.stdout // "") else tostring end' |
  grep -q '/pull/[0-9]' || { echo '{}'; exit 0; }

root="${CLAUDE_PROJECT_DIR:-$PWD}"
cd "$root"
floor=$(node scripts/reviewFloor.ts 2>/dev/null) || { echo '{}'; exit 0; }

message=$(printf '%s' "$floor" | jq -r '
  "Review floor of this pull request: \(.floor) — " +
  (if (.categories | length) > 0 then ([.categories[].name] | join(", ")) else "no category matched" end) +
  ". Ask for /risk-review to get the Review guide."') || { echo '{}'; exit 0; }

printf '{"systemMessage":%s,"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":%s}}' \
  "$(printf '%s' "$message" | jq -Rs .)" "$(printf '%s' "$message" | jq -Rs .)"
