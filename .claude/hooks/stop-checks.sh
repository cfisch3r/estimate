#!/bin/sh
# Stop hook: once per turn, project-wide. Runs typecheck, the FSD architecture
# scan (Steiger), dead-code detection (knip), and the full test suite with the
# entities/estimate coverage threshold — in parallel, since none depends on
# another's output. Blocks the Stop (forcing another turn) on failure so
# Claude fixes issues before handing back to the user, rather than only finding
# out at PR/CI time. See docs/adr/004-feature-sliced-design-architecture.md.
set -u

root="${CLAUDE_PROJECT_DIR:-$PWD}"
cd "$root" || exit 0

tmpdir=$(mktemp -d)
trap 'rm -rf "$tmpdir"' EXIT

run_check() {
  label="$1"
  slug="$2"
  shift 2
  if "$@" >"$tmpdir/$slug.log" 2>&1; then
    rm -f "$tmpdir/$slug.log"
  else
    echo "$label" >"$tmpdir/$slug.failed"
  fi
}

run_check "typecheck (tsc -b)" typecheck pnpm typecheck &
run_check "architecture boundaries (steiger)" arch pnpm arch &
run_check "dead code (knip)" deadcode pnpm deadcode &
run_check "tests + coverage" test pnpm test:coverage &
wait

fail=""
for slug in typecheck arch deadcode test; do
  if [ -f "$tmpdir/$slug.failed" ]; then
    fail="${fail}## $(cat "$tmpdir/$slug.failed") failed
$(tail -c 4000 "$tmpdir/$slug.log")

"
  fi
done

if [ -n "$fail" ]; then
  printf '{"decision":"block","reason":%s}' "$(printf '%s' "$fail" | jq -Rs .)"
else
  echo '{}'
fi
