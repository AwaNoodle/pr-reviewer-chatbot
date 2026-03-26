## 1. Signal Data Model and GitHub Integration

- [ ] 1.1 Define normalized signal types (checks, statuses, scanning source state, severity buckets) in `src/types/index.ts`.
- [ ] 1.2 Add GitHub service methods for PR-head-SHA checks/status retrieval in `src/services/github.ts`.
- [ ] 1.3 Add code-scanning signal retrieval and normalization with explicit unavailable/permission-limited mapping.

## 2. State Orchestration and Context Fusion

- [ ] 2.1 Extend `src/store/slices/prsSlice.ts` with signal lifecycle state and async thunk orchestration.
- [ ] 2.2 Trigger signal loading during PR context fetch/refresh and on head SHA changes.
- [ ] 2.3 Inject normalized signal highlights into summary/chat prompt construction in `src/services/llm.ts`.
- [ ] 2.4 Implement a shared normalized signal snapshot builder consumed by summary and chat prompt construction.
- [ ] 2.5 Implement deterministic ranking and top-N capping for failing, pending, and high-severity signal highlights.
- [ ] 2.6 Preserve explicit source-state semantics (`ok-empty`, `unavailable`, `error`) in prompt-ready signal context.

## 3. Reviewer UI

- [ ] 3.1 Add a Signals section/tab in `src/components/PRViewer.tsx` with success/failure/pending/unavailable/error states.
- [ ] 3.2 Render failing and pending signal highlights with names and counts.
- [ ] 3.3 Surface availability-limit messaging when scanning/check sources are inaccessible.
- [ ] 3.4 Keep UI semantics aligned with prompt semantics so unavailable/error states are never implied as passing.
- [ ] 3.5 Render failing/pending signal highlights in stable ranking order.

## 4. Verification

- [ ] 4.1 Add tests for GitHub signal endpoint mapping and normalization behavior.
- [ ] 4.2 Add slice and component tests for signal lifecycle and UI state rendering.
- [ ] 4.3 Run `npm run lint -- --max-warnings=0`, `npm run build`, and `npm run test`.
- [ ] 4.4 Add tests for summary prompt signal section shape, bounded detail, and availability caveats.
- [ ] 4.5 Add tests for compact chat signal snapshot shape and truncation behavior.
- [ ] 4.6 Add tests that unavailable/error source states are never mapped to passing/no-findings semantics.
