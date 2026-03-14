## Context

The current reviewer workflow starts with raw PR metadata and diffs, then relies on free-form chat questions for orientation. This increases time-to-context, especially for large or complex pull requests. The application already has stable GitHub data-loading flows, an LLM service abstraction, and a right-pane PR viewer with tabbed detail views, which makes a summary-first reviewer experience a natural extension.

This change spans multiple modules (settings, PR state, GitHub service, LLM prompt assembly, and PR viewer UI), includes new persistence behavior (sessionStorage cache + localStorage config), and adds request-guard behavior (per-PR one-per-minute rate limiting). It also introduces stricter output-shape requirements for generated content.

## Goals / Non-Goals

**Goals:**
- Provide an optional auto-generated PR summary, enabled by default, immediately after PR selection.
- Render summaries in a dedicated `Summary` tab in the right-hand PR pane, not in chat history.
- Keep summary generation aligned with existing LLM configuration and API path.
- Make the summary prompt editable/persisted with a reset-to-default action.
- Enforce safe fallback states (`Empty PR`, `Unable to generate summary`) and avoid runaway generation via per-PR rate limits.
- Cache generated summaries in sessionStorage and display generation timestamp.

**Non-Goals:**
- Creating a separate LLM provider or model configuration for summaries.
- Persisting summaries across browser sessions (cache is session-scoped by design).
- Replacing existing chat interactions or auto-answering reviewer follow-up questions.

## Decisions

1. **Summary state lives in PR domain state, not chat state**
   - **Decision:** Add summary-specific fields under `prsSlice` (status, content, generated timestamp, and error state), and render them in `PRViewer`.
   - **Rationale:** Summary is PR metadata context, not conversational history. Keeping it out of `chatSlice` ensures it cannot accidentally leak into chat context.
   - **Alternatives considered:**
     - Reusing `chatSlice` with special system messages (rejected: conflicts with requirement to exclude summaries from chat history/context).
     - Component-local state only (rejected: weaker consistency across tabs and PR reload flows).

2. **Add a dedicated PR summary orchestration path**
   - **Decision:** Introduce a summary generation helper/service used by PR selection flows, with explicit logic for empty detection, cache lookup, and rate limiting.
   - **Rationale:** Centralizes policy (one-per-minute per PR, cache key strategy, fallback behavior) and keeps UI components simpler.
   - **Alternatives considered:**
     - Inline logic in `PRViewer` or `Sidebar` (rejected: duplicated complexity and harder testability).

3. **Per-PR rate limit and cache key strategy**
   - **Decision:** Key by PR identity (`owner/repo`, PR number, head SHA) plus prompt/command fingerprint.
   - **Rationale:** Prevents stale summaries after prompt edits or branch updates while allowing fast cache hits for unchanged context.
   - **Alternatives considered:**
     - Global rate limit (rejected per product decision).
     - PR-only key without prompt fingerprint (rejected: would return mismatched cached summaries after prompt customization).

4. **Summary prompt model**
   - **Decision:** Use a persisted `summaryPrompt` defaulted to the product-provided baseline prompt; append optional `summaryCommands`; enforce section contract (`PR Context`, `Focus Areas`) and stylistic constraints in summary instruction payload.
   - **Rationale:** Preserves user control while maintaining stable output contract for UI expectations.
   - **Alternatives considered:**
     - Fixed prompt only (rejected: conflicts with editability requirement).
     - Free-form output with no section contract (rejected: weak consistency).

5. **Use existing LLM config and transport**
   - **Decision:** Summary generation uses the same `LLMService` instance/config already used for chat.
   - **Rationale:** Simpler operations model, no duplicated configuration surface, consistent provider behavior.
   - **Alternatives considered:**
     - Separate summary model/backend settings (rejected by requirement and would add UX complexity).

6. **Commit messages become first-class summary context**
   - **Decision:** Extend GitHub service/store flows to fetch PR commits and make commit messages available to summary prompt building.
   - **Rationale:** Required by default prompt and improves orientation fidelity.
   - **Alternatives considered:**
     - Deriving commit context only from PR title/body (rejected: misses important intent details).

## Risks / Trade-offs

- **[Risk] Extra API and token cost on PR selection** -> **Mitigation:** summary toggle (default on but user-controlled), one-per-minute per-PR rate limit, and session cache reuse.
- **[Risk] Empty/binary-heavy PRs cause poor summary quality** -> **Mitigation:** detect absence of textual diff content and show `Empty PR` without calling LLM.
- **[Risk] Inconsistent output formatting from model** -> **Mitigation:** explicit section/format instructions in summary prompt; tolerant rendering in Summary tab.
- **[Risk] Race conditions when switching PRs rapidly** -> **Mitigation:** key requests by selected PR identity and discard stale in-flight responses when active PR changes.
- **[Risk] Added state complexity in PR slice** -> **Mitigation:** isolate summary fields and reducers, plus focused unit tests for transitions.

## Migration Plan

1. Add new config fields with backward-compatible defaults (`summaryEnabled: true`, default summary prompt, empty summary commands).
2. Add commit fetch API and state support; ensure existing PR load paths remain functional.
3. Implement summary orchestration (cache/rate-limit/empty checks) and wire it to PR selection lifecycle.
4. Add `Summary` tab rendering states and generated timestamp footer in `PRViewer`.
5. Update Settings UI with summary controls and reset behavior.
6. Add/expand tests for config, store transitions, summary utility logic, and prompt composition.
7. Update documentation for new summary feature behavior.

Rollback strategy: disable summary feature by default through config fallback or temporarily gate summary generation trigger; existing chat and PR viewer tabs remain operational.

## Open Questions

- None at this time; product behavior is fully specified for this change.
