## Why

Current review analysis relies mostly on PR metadata, comments, and diffs, which can miss high-signal runtime and security context already available in GitHub checks and scanning systems. Bringing CI and code-scanning signals into the review loop improves prioritization and helps reviewers focus on real risk faster.

## What Changes

- Add signal fusion that fetches CI/check status data and relevant code-scanning indicators for the selected PR head SHA.
- Expose a reviewer-facing Signals view and status summaries that clearly identify failing/pending/high-risk items.
- Enrich summary generation and chat context with normalized signal data so assistant guidance reflects CI/security reality.

## Capabilities

### New Capabilities
- `pr-signal-fusion`: Aggregation, normalization, and presentation of CI/check/code-scanning signals for selected PRs.

### Modified Capabilities
- `pr-review-summary`: Summary output contract is extended to incorporate high-risk CI/scanning signals into reviewer guidance when available.

## Impact

- Affected code: `src/services/github.ts`, `src/store/slices/prsSlice.ts`, `src/services/llm.ts`, `src/components/PRViewer.tsx`, and related tests/types.
- APIs: additional GitHub REST endpoints for statuses/check-runs and security scanning metadata.
- Dependencies/systems: no required external services beyond existing GitHub integration; feature depends on repository permissions and token scopes.
