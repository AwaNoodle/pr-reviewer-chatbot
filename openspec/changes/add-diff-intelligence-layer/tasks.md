## 1. Prompt and Data Contract

- [x] 1.1 Define citation-related types for assistant claims and references in `src/types/index.ts`.
- [x] 1.2 Extend `src/services/llm.ts` summary/chat prompt instructions to request structured diff-grounded references for non-trivial claims.
- [x] 1.3 Implement robust parsing/normalization utilities for citation payloads with markdown fallback behavior.

## 2. State and Navigation Wiring

- [x] 2.1 Add citation-aware assistant payload fields in chat/summary state handling without breaking existing message rendering.
- [x] 2.2 Implement citation-to-diff resolver logic that maps file plus optional line/hunk anchors to current PR file patches.
- [x] 2.3 Add unresolved-reference handling path that opens file context and surfaces a clear non-blocking indicator.

## 3. UI Rendering and Interaction

- [x] 3.1 Render citation chips and uncited/low-confidence indicators in `src/components/ChatWindow.tsx` assistant output.
- [x] 3.2 Render citation chips in summary panels in `src/components/PRViewer.tsx` and wire click behavior to Files tab navigation.
- [x] 3.3 Add file highlight/focus behavior for resolved citation targets in the diff viewer.

## 4. Verification

- [x] 4.1 Add unit tests for citation parser and resolver edge cases (missing file, stale anchor, malformed payload).
- [x] 4.2 Add component tests for citation rendering, uncited indicators, and click-to-navigate interactions.
- [x] 4.3 Run `npm run lint -- --max-warnings=0`, `npm run build`, and `npm run test`.
