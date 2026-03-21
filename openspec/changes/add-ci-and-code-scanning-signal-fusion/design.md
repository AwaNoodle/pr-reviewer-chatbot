## Context

The application currently evaluates PRs from metadata, diffs, and discussion context, but it does not incorporate CI outcomes or security scanning signals that are already available in GitHub. Reviewers therefore lack an integrated view of execution and security posture while reading assistant guidance.

This change spans API integration, state orchestration, prompt construction, and UI presentation, requiring a coordinated design.

## Goals / Non-Goals

**Goals:**
- Fetch and normalize CI/check and code-scanning signals for the selected PR head SHA.
- Surface signal health directly in the reviewer UI with clear pass/fail/pending/error states.
- Inject normalized signals into summary/chat context so model output reflects real check and security state.

**Non-Goals:**
- This change does not own CI execution, reruns, or workflow management.
- This change does not guarantee repository-wide security coverage beyond available API permissions.
- This change does not implement organization-wide policy gating or enforcement.

## Decisions

### Decision: Build a normalized signal model in app state
- **Choice:** Add a signal aggregation model in `prsSlice` with additive state (`status`, `checks`, `statuses`, `scanning`, `error`, `fetchedAt`).
- **Rationale:** A normalized model isolates GitHub API heterogeneity and gives UI/LLM layers a stable contract.
- **Alternatives considered:**
  - Keep raw endpoint payloads in state: rejected because UI and prompts would be tightly coupled to API shape.

### Decision: Fetch signals by PR head SHA via dedicated GitHub service methods
- **Choice:** Add service methods for status/check-runs and code-scanning lookups tied to active PR head SHA.
- **Rationale:** Head-SHA scoping prevents stale branch-level interpretation and aligns with reviewer expectations.
- **Alternatives considered:**
  - Fetch only PR-level metadata checks summary: rejected because details needed for actionable guidance are lost.

### Decision: Treat unavailable or unauthorized signals as first-class fallback states
- **Choice:** Explicitly represent unavailable/permission-limited signal states and render them distinctly from healthy/empty states.
- **Rationale:** Silent omission would mislead users into assuming no risk signals exist.
- **Alternatives considered:**
  - Hide unavailable sources: rejected because it obscures confidence and data completeness.

### Decision: Fuse signals into summary guidance with bounded verbosity
- **Choice:** Prompt contract includes top failing/pending/high-severity signals and limits signal detail to reviewer-relevant highlights.
- **Rationale:** Improves prioritization without overwhelming summaries.
- **Alternatives considered:**
  - Dump full signal payload into prompt: rejected due to noise and token waste.

## Risks / Trade-offs

- [API permission variability across repos/orgs] -> Mitigation: add explicit per-source unavailable states and user-facing guidance.
- [Increased API call volume] -> Mitigation: fetch once per PR head SHA selection and reuse existing refresh flows.
- [Signal drift after new commits] -> Mitigation: invalidate signal data on head SHA change and re-fetch.
- [Prompt bloat from signal details] -> Mitigation: include compact normalized summaries with strict cap on items.

## Migration Plan

1. Add signal endpoint methods and typed response normalization in `src/services/github.ts` and related types.
2. Extend `prsSlice` with signal lifecycle state and loading/error handling.
3. Add signal fetch orchestration on PR load/refresh and head SHA changes.
4. Add Signals UI rendering with explicit unavailable/error/empty/success states.
5. Inject normalized signals into summary/chat prompt context and validate output quality.
6. Add tests for service mapping, state transitions, and UI rendering paths.

Rollback strategy: gate signal rendering and prompt injection on successful signal state; if disabled/removed, app returns to existing diff-and-discussion-only behavior.

## Open Questions

- Which specific code-scanning endpoints should be default-on vs optional due to permission cost?
- Should signal summaries include historical trend (last green) or only current state?
- Do we need per-repo setting to disable code-scanning fetches for noisy environments?
