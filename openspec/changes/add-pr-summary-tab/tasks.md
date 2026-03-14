## 1. Configuration and Defaults

- [ ] 1.1 Extend `AppConfig` with `summaryEnabled`, `summaryPrompt`, and `summaryCommands` fields.
- [ ] 1.2 Add and export the default summary prompt constant using the product-provided baseline prompt text.
- [ ] 1.3 Update config slice load/save/default behavior to persist summary settings while keeping sensitive field handling unchanged.
- [ ] 1.4 Add config slice tests for summary defaults, persistence, and reset-only-prompt behavior.

## 2. PR Data and Summary State Model

- [ ] 2.1 Extend GitHub service with a PR commits endpoint and related types for commit message context.
- [ ] 2.2 Add PR commits state and async thunk wiring in `prsSlice` and store update flows.
- [ ] 2.3 Add summary-specific PR state fields (`status`, `content`, `generatedAt`, `error`) and reducers/actions for lifecycle transitions.
- [ ] 2.4 Add/expand PR slice and GitHub service tests for commit loading and summary state transitions.

## 3. Summary Orchestration and Prompt Assembly

- [ ] 3.1 Implement summary utility logic for per-PR cache keying, one-per-minute rate limiting, and sessionStorage read/write.
- [ ] 3.2 Implement empty-PR detection that skips generation when no textual diff content is available.
- [ ] 3.3 Extend LLM summary prompt assembly to include editable prompt text, optional summary commands, required section contract, and style constraints.
- [ ] 3.4 Ensure summary generation uses existing LLM configuration and never inserts summary content into chat history/context.
- [ ] 3.5 Add unit tests for summary utility behavior and summary prompt composition.
- [ ] 3.6 Refine summary output contract to prioritize quick orientation: enforce a 2-4 line top summary and adaptive `Focus Areas` (0-4 items, no minimum).
- [ ] 3.7 Ensure each emitted focus area includes: review target (`where`), rationale (`why it matters`), and reviewer guidance (`what to verify`).
- [ ] 3.8 Add/expand summary prompt tests to assert: orientation is constrained to 2-4 lines, focus areas are adaptive, zero focus areas are valid, and output never exceeds 4 focus areas.

## 4. UI Integration

- [ ] 4.1 Add summary controls to Settings (enable toggle, editable prompt, additional commands input, reset prompt button).
- [ ] 4.2 Add a `Summary` tab to `PRViewer` with loading spinner, success rendering, empty/failure states, and timestamp footer.
- [ ] 4.3 Trigger summary generation on PR selection, clear chat when PR changes, and guard against stale in-flight responses.
- [ ] 4.4 Add/expand UI tests for settings interactions and summary tab state rendering.
- [ ] 4.5 Add/expand Summary tab rendering tests for orientation-only success output (no focus areas), adaptive rendering for 1-4 focus areas, and graceful handling when focus areas are omitted.

## 5. Documentation and Validation

- [ ] 5.1 Update README documentation for summary behavior, settings, fallback states, cache/rate-limit behavior, and output expectations.
- [ ] 5.2 Update `plans/plan.md` and any relevant agent guidance to reflect the new summary feature scope.
- [ ] 5.3 Run `npm run lint`, `npm run test`, and `npm run build`, then resolve any failures, including new quick-orientation summary contract tests.
