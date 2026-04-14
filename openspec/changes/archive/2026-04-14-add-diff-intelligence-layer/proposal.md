## Why

PR summaries and chat answers are useful, but they are not consistently traceable to exact diff locations. Reviewers need grounded, clickable evidence to validate claims quickly and avoid trusting uncited model output.

## What Changes

- Add a diff-intelligence layer that requires grounded references for non-trivial summary and chat claims.
- Render file/hunk citations in assistant output and make each citation navigable to the corresponding diff location.
- Introduce clear fallback semantics when grounding data is missing, malformed, or cannot be resolved in the current PR view.

## Capabilities

### New Capabilities
- `diff-intelligence`: Structured claim grounding and citation navigation across summary and chat experiences.

### Modified Capabilities
- `pr-review-summary`: Summary output contract is extended to include diff-grounded references for meaningful claims.

## Impact

- Affected code: `src/services/llm.ts`, `src/services/summary.ts`, `src/store/slices/prsSlice.ts`, `src/components/PRViewer.tsx`, `src/components/ChatWindow.tsx`, and supporting type definitions/tests.
- APIs: no external API changes; internal assistant response contract extended with optional citation payloads.
- Dependencies/systems: no required new runtime dependency; markdown rendering and diff navigation wiring will be enhanced.
