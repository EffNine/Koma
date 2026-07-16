#!/usr/bin/env bash
set -euo pipefail

# Run each test file sequentially with a 120s timeout per file.
# Reports progress so we can see which test hangs in CI.
# On Linux (CI) the `timeout` command is used; on macOS fall back to
# running without a timeout wrapper — tests are fast enough locally.

if command -v timeout &>/dev/null; then
  TIMEOUT="timeout 120"
elif command -v gtimeout &>/dev/null; then
  TIMEOUT="gtimeout 120"
else
  TIMEOUT=""
fi

TESTS=(
  scraper.test.ts
  reader.test.ts
  reader-settings.test.ts
  reader-chapter-session.test.ts
  source-health.test.ts
  fallback.test.ts
  title-chapter-source.test.ts
  source-feed.test.ts
  search-route-state.test.ts
  continue-reading.test.ts
  title-preferences.test.ts
  chapter-groups.test.ts
  library.test.ts
  sources.test.ts
  tracker.test.ts
  tracker-sync.test.ts
  oauth.test.ts
  progress.test.ts
  driver.test.ts
  spread.test.ts
  util.test.ts
  router.test.ts
  open-title-candidate.test.ts
  empty-state.test.ts
  feedback.test.ts
  confirmation.test.ts
  formatting.test.ts
  pwa.test.ts
  comick-driver.test.ts
  driver-registry.test.ts
)

failures=0
for t in "${TESTS[@]}"; do
  echo "::group::Running $t"
  # shellcheck disable=SC2086
  if $TIMEOUT npx tsx "tests/$t"; then
    echo "::endgroup::"
    echo "✅ $t passed"
  else
    echo "::endgroup::"
    echo "❌ $t failed"
    ((failures++))
  fi
done

if [ "$failures" -gt 0 ]; then
  echo "---"
  echo "$failures test(s) failed"
  exit 1
fi
echo "---"
echo "All tests passed"

