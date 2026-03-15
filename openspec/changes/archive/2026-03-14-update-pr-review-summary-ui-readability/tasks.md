## 1. Summary Panelized Presentation

- [x] 1.1 Update successful Summary tab rendering in `src/components/PRViewer.tsx` to display content in panel/card blocks matching Comments/Reviews pane styling patterns.
- [x] 1.2 Split successful summary output into one `Orientation` panel and one panel per `Focus Area` entry when present.
- [x] 1.3 Add title accent styles for panel headers: blue for `Orientation`, yellow for `Focus Area` panels.

## 2. Keep Existing Behavior Intact

- [x] 2.1 Preserve current summary generation pipeline, prompt/config usage, and summary content contract (no backend/API/LLM-flow changes).
- [x] 2.2 Preserve existing loading, empty, and error state behavior and messaging.

## 3. Validation

- [x] 3.1 Update/add Summary tab component tests to verify panelized rendering for orientation-only and orientation+focus-areas outputs.
- [x] 3.2 Verify visual consistency with Comments/Reviews card styling and title color accents in desktop and mobile widths.
- [x] 3.3 Run lint, typecheck, and tests to ensure no regressions.
