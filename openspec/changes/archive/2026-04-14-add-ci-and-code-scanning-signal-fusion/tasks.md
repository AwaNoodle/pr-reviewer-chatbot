## 1. Signal Data Model and GitHub Integration

- [x] 1.1 Define normalized signal types (checks, statuses, scanning source state, severity buckets) in `src/types/index.ts`.
- [x] 1.2 Add GitHub service methods for PR-head-SHA checks/status retrieval in `src/services/github.ts`.
- [x] 1.3 Add code-scanning signal retrieval and normalization with explicit unavailable/permission-limited mapping.

## 2. State Orchestration and Context Fusion

- [x] 2.1 Extend `src/store/slices/prsSlice.ts` with signal lifecycle state and async thunk orchestration.
- [x] 2.2 Trigger signal loading during PR context fetch/refresh and on head SHA changes.
- [x] 2.3 Inject normalized signal highlights into summary/chat prompt construction in `src/services/llm.ts`.
- [x] 2.4 Implement a shared normalized signal snapshot builder consumed by summary and chat prompt construction.
- [x] 2.5 Implement deterministic ranking and top-N capping for failing, pending, and high-severity signal highlights.
- [x] 2.6 Preserve explicit source-state semantics (`ok-empty`, `unavailable`, `error`) in prompt-ready signal context.

## 3. Reviewer UI

- [x] 3.1 Add a Signals section/tab in `src/components/PRViewer.tsx` with success/failure/pending/unavailable/error states.
- [x] 3.2 Render failing and pending signal highlights with names and counts.
- [x] 3.3 Surface availability-limit messaging when scanning/check sources are inaccessible.
- [x] 3.4 Keep UI semantics aligned with prompt semantics so unavailable/error states are never implied as passing.
- [x] 3.5 Render failing/pending signal highlights in stable ranking order.

## 4. Verification

- [x] 4.1 Add tests for GitHub signal endpoint mapping and normalization behavior.
- [x] 4.2 Add slice and component tests for signal lifecycle and UI state rendering.
- [x] 4.3 Run `npm run lint -- --max-warnings=0`, `npm run build`, and `npm run test`.
- [x] 4.4 Add tests for summary prompt signal section shape, bounded detail, and availability caveats.
- [x] 4.5 Add tests for compact chat signal snapshot shape and truncation behavior.
- [x] 4.6 Add tests that unavailable/error source states are never mapped to passing/no-findings semantics.
