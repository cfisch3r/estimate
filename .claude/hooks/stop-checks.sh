#!/bin/sh
# Stop hook: once per turn, project-wide. Runs typecheck, the FSD architecture
# scan (Steiger), dead-code detection (knip), and the full test suite with the
# /calc coverage threshold. Blocks the Stop (forcing another turn) on failure so
# Claude fixes issues before handing back to the user, rather than only finding
# out at PR/CI time. See docs/adr/004-feature-sliced-design-architecture.md.
set -u

root="${CLAUDE_PROJECT_DIR:-$PWD}"
cd "$root" || exit 0

fail=""
run_check() {
  label="$1"
  shift
  log=$(mktemp)
  if ! "$@" >"$log" 2>&1; then
    fail="${fail}## ${label} failed
$(tail -c 4000 "$log")

"
  fi
  rm -f "$log"
}

run_check "typecheck (tsc -b)" pnpm typecheck
run_check "architecture boundaries (steiger)" pnpm arch
run_check "dead code (knip)" pnpm deadcode
run_check "tests + coverage" pnpm test:coverage

if [ -n "$fail" ]; then
  printf '{"decision":"block","reason":%s}' "$(printf '%s' "$fail" | jq -Rs .)"
else
  echo '{}'
fi
