## Why

The PR Summary tab currently renders dense, low-hierarchy content that is difficult to scan quickly during review. Improving readability now reduces reviewer fatigue and helps users identify key changes faster without changing the underlying summary generation flow.

## What Changes

- Update PR Summary tab display to render generated content in discrete panels using the same container styling pattern as the Comments and Reviews panes.
- Split summary output into an `Orientation` panel and one panel per `Focus Area` item when present.
- Apply title color accents to improve scanability: blue for `Orientation` and yellow for each `Focus Area` panel title.
- Preserve existing summary generation flow, prompt/config behavior, caching/rate-limiting, and fallback-state behavior.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `pr-review-summary`: Update summary tab presentation requirements to enforce readable hierarchy, spacing, and markdown rendering behavior across summary states.

## Impact

- Affected UI: `src/components/PRViewer.tsx` summary tab rendering and related style definitions.
- Potentially affected tests: summary tab component tests and visual-state assertions.
- No API contract changes, backend changes, or dependency additions expected.
