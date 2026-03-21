# PR Review Chatbot - Implementation Plan

## Priority: UI and LLM Integration First
**Key Change**: Use dummy data for PR content to allow immediate interaction with the LLM without needing GitHub API credentials. GitHub integration can be added later.

---

## Tech Stack
- Vite + React 18 + TypeScript
- Redux Toolkit for state management
- Axios for HTTP
- Tailwind CSS for styling
- Radix UI for accessible components

---

## Implementation Phases

### ✅ Phase 1: Project Setup (COMPLETED)
- [x] Initialize Vite + React + TypeScript project
- [x] Install dependencies (Redux Toolkit, Axios, Tailwind, Radix UI, react-markdown, react-syntax-highlighter, lucide-react)
- [x] Configure Tailwind CSS with CSS variables for theming
- [x] Set up project structure (`src/types`, `src/store`, `src/services`, `src/components`, `src/lib`)
- [x] Create `vite-env.d.ts` for Vite environment type declarations
- [x] Create `.env.example` with all configuration options
- [x] Create `.gitignore`

### ✅ Phase 2: UI Shell & Configuration (COMPLETED)
- [x] Create Redux store (`src/store/index.ts`)
- [x] Implement `configSlice.ts` — env var defaults + localStorage runtime overrides
- [x] Implement `chatSlice.ts` — messages, streaming state
- [x] Implement `prsSlice.ts` — selected PR, files, comments, reviews
- [x] Create typed Redux hooks (`src/store/hooks.ts`)
- [x] Create `SettingsDialog.tsx` — runtime config override with demo mode toggle
- [x] Create main `App.tsx` layout (sidebar + chat + PR viewer panels)
- [x] Dark mode toggle in top bar
- [x] Collapsible sidebar and PR viewer panels

### ✅ Phase 3: Chat Interface (COMPLETED)
- [x] Build `ChatWindow.tsx` with message display
- [x] User/assistant message bubbles with avatars
- [x] Markdown rendering with `react-markdown` + `remark-gfm`
- [x] Code syntax highlighting with `react-syntax-highlighter`
- [x] Streaming response display (animated cursor)
- [x] Auto-scroll to latest message
- [x] Multi-line textarea input (auto-resize)
- [x] Enter to send, Shift+Enter for new line
- [x] Suggestion chips on empty state
- [x] Clear conversation button
- [x] Error display in message bubbles

### ✅ Phase 4: LLM Integration (COMPLETED)
- [x] Implement `LLMService` class in `src/services/llm.ts`
- [x] OpenAI v1 API support (`/chat/completions`)
- [x] LiteLLM Proxy support (same API format)
- [x] Streaming via Server-Sent Events (SSE)
- [x] `buildSystemPrompt()` — injects full PR context (metadata, diffs, comments, reviews)
- [x] Connect LLM service to `ChatWindow` with streaming dispatch
- [x] Error handling for API failures

### ✅ Phase 5: Dummy Data & Demo Mode (COMPLETED)
- [x] Create `src/services/dummyData.ts` with realistic sample PR
  - Sample PR: JWT authentication feature (8 files, realistic diffs)
  - Sample comments, review comments, and reviews
- [x] Build `PRViewer.tsx` with:
  - PR metadata header (state badge, author, branch, stats)
  - Tabs: Files, Comments, Reviews
  - Collapsible file items with diff view
  - Diff syntax highlighting (green/red/blue lines)
  - Status badges per file (added/modified/removed)
- [x] Build `Sidebar.tsx` with demo mode toggle
- [x] Auto-load dummy PR on startup in demo mode
- [x] Demo mode toggle in sidebar and Settings dialog

### ✅ Phase 6: GitHub Integration (COMPLETED)
- [x] Implement `GitHubService` class in `src/services/github.ts`
- [x] PAT (Bearer token) authentication
- [x] Support for github.com (`https://api.github.com`)
- [x] Support for GHES (`https://<host>/api/v3`)
- [x] Methods: `listRepositories`, `searchRepositories`, `listPullRequests`, `getPullRequest`, `getPRFiles`, `getPRComments`, `getPRReviewComments`, `getPRReviews`, `validateToken`
- [x] Token validation method

### ✅ Phase 7: Polish (COMPLETED)
- [x] Add loading states and loading indicators for GitHub API calls
- [x] Add error handling for GitHub API failures (rate limiting, 404, auth errors)
- [x] Polish UI/UX (animations, transitions)
- [x] GitHub mode UI — allow entering repo/PR manually
- [x] Context window management for very large PRs

---

## Documentation (COMPLETED)
- [x] `README.md` — User-facing docs: quick start, configuration, LLM setup, GitHub setup, troubleshooting
- [x] `agents.md` — Developer/agent docs: project structure, architecture, common tasks
- [x] `.env.example` — Annotated environment variable reference

---

## Configuration

### Environment Variables (with defaults)
```
VITE_GITHUB_PAT=          # GitHub Personal Access Token
VITE_LLM_API_KEY=         # LLM API Key
VITE_GITHUB_INSTANCE=     # "github.com" or URL for GHES
VITE_LLM_BACKEND=         # "openai" or "litellm"
VITE_LLM_ENDPOINT=        # API endpoint URL
VITE_LLM_MODEL=           # Model name
VITE_DEMO_MODE=           # "true" or "false"
```

### Runtime Override
Settings dialog allows overriding env vars at runtime (persisted to localStorage).

---

## Architecture

### Services
```
src/services/
├── github.ts      # Fetch PRs, details, diffs, comments (supports GHES)
├── llm.ts         # Unified interface for OpenAI v1 API + LiteLLM Proxy
└── dummyData.ts   # Sample PR data for demo mode
```

### Redux Store
```
src/store/
├── index.ts              # Store configuration
├── hooks.ts              # Typed useAppDispatch / useAppSelector
└── slices/
    ├── configSlice.ts    # App config (env defaults + runtime overrides)
    ├── prsSlice.ts       # Current PR data
    └── chatSlice.ts      # Messages + streaming state
```

### Components
```
src/components/
├── SettingsDialog.tsx   # Runtime config override
├── Sidebar.tsx          # Repo/PR navigation (or demo mode toggle)
├── ChatWindow.tsx       # Chat messages + input
└── PRViewer.tsx         # File diffs, metadata
```

---

## Data Types

### GitHub PR
```typescript
interface PullRequest {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  merged: boolean;
  merged_at: string | null;
  user: GitHubUser;
  created_at: string;
  updated_at: string;
  head: { ref: string; sha: string; repo: { full_name: string } | null };
  base: { ref: string; sha: string; repo: { full_name: string } };
  url: string;
  html_url: string;
  diff_url: string;
  additions: number;
  deletions: number;
  changed_files: number;
  comments: number;
  review_comments: number;
  commits: number;
  labels: Array<{ id: number; name: string; color: string }>;
  requested_reviewers: GitHubUser[];
}
```

### Chat Message
```typescript
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
  error?: string;
}
```

### App Config
```typescript
interface AppConfig {
  githubPat: string;
  llmApiKey: string;
  githubInstance: string;
  llmBackend: 'openai' | 'litellm';
  llmEndpoint: string;
  llmModel: string;
  demoMode: boolean;
}
```

---

## Error Handling

### LLM API Errors
- Invalid API key: Error shown in message bubble
- Rate limiting: Error shown in message bubble
- Network errors: Error shown in message bubble
- Streaming errors: Graceful fallback with error message

### GitHub API Errors (when enabled)
- Invalid PAT: Prompt to update token
- Rate limiting: Show remaining requests
- Not found (404): Repository/PR not found

---

### ⏳ Phase 8: Code Quality & UX Improvements (PENDING)

Identified during initial code review. These are non-blocking improvements to address after the Phase 7 polish work.

#### Quality
- [x] **ESLint v9 flat config** (`eslint.config.js`) — Added repository-level flat config so `npm run lint` works with ESLint 9.
- [x] **`getPRFiles` pagination** (`src/services/github.ts:96`) — The GitHub API caps file lists at 100 per page. PRs with >100 changed files silently return incomplete data. Add pagination (loop until `response.data.length < perPage`) or at minimum show a warning banner in `PRViewer` when the file count equals the page limit.
- [x] **Stable React keys in `DiffView`** (`src/components/PRViewer.tsx:41`) — Diff lines currently use array index as `key`. Replace with a content-based key (e.g. `` `${i}-${line.slice(0, 8)}` ``) to prevent React reusing DOM nodes incorrectly when switching between files.

#### UX
- [x] **Persist dark mode preference** (`src/App.tsx:10`) — Dark mode state resets on every page reload. Initialise from `localStorage` and respect the OS `prefers-color-scheme` media query:
  ```ts
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem('darkMode') === 'true'
      || window.matchMedia('(prefers-color-scheme: dark)').matches
  );
  ```
  Also persist the toggle: `localStorage.setItem('darkMode', String(!darkMode))` inside `toggleDarkMode`.
- [x] **Wire up the Refresh button** (`src/components/Sidebar.tsx:111`) — The refresh `<button>` in the sidebar is rendered in GitHub mode but has no `onClick` handler. Either connect it to a `fetchPullRequests` thunk (part of Phase 7 GitHub UI work) or hide it with `{false && ...}` until that feature is ready, to avoid confusing users with a dead control.

---

## OpenSpec Alignment Notes (2026-03-14)

- `openspec/changes/add-pr-summary-tab/tasks.md` was updated to capture quick-orientation behavior decisions from explore mode.
- Summary behavior target: 2-4 line orientation section, adaptive `Focus Areas` with bounds `0..4`, and valid success output when focus areas are omitted for simple PRs.
- Synced delta spec `openspec/changes/add-pr-summary-tab/specs/pr-review-summary/spec.md` into new main spec `openspec/specs/pr-review-summary/spec.md`.
- Added change scaffold `openspec/changes/update-pr-review-summary-ui-readability/` with completed proposal, design, spec delta, and tasks artifacts for summary UI readability improvements.
- Refined `update-pr-review-summary-ui-readability` scope to panelized Summary display: Orientation and each Focus Area render as separate cards styled like Comments/Reviews, with blue/yellow title accents and no spec contract changes.

---

## ✅ Phase 9: PR Summary Tab (COMPLETED)

- [x] Extend `AppConfig` with summary fields: `summaryEnabled`, `summaryPrompt`, `summaryCommands`
- [x] Add/export `DEFAULT_SUMMARY_PROMPT` and keep reset behavior prompt-only
- [x] Add PR commits API loading (`getPRCommits`) and Redux state wiring
- [x] Add summary lifecycle state in `prsSlice` (`status`, `content`, `generatedAt`, `error`)
- [x] Implement summary orchestration utilities:
  - per-PR+head+prompt cache keying
  - sessionStorage read/write cache
  - one-per-minute per-PR-head rate limiting
  - empty textual diff detection
- [x] Extend LLM service with structured summary prompt assembly (orientation + adaptive focus areas)
- [x] Add Summary tab UI in `PRViewer` with loading/success/empty/error states and timestamp footer
- [x] Wire summary generation on PR selection/load and keep summary separate from chat history/context
- [x] Add/expand tests for config, GitHub service, PR slice, summary utilities, LLM prompt, Settings UI, and Summary tab rendering
- [x] Update README and agent guidance for summary behavior, fallback states, and output contract

---

## OpenSpec Implementation Updates (2026-03-14)

- [x] Completed OpenSpec change `update-pr-review-summary-ui-readability` implementation tasks (8/8) for panelized Summary tab readability updates.
- [x] Updated Summary success rendering in `src/components/PRViewer.tsx` to show an `Orientation` panel and per-item `Focus Area N` panels with blue/yellow title accents.
- [x] Kept summary generation flow and fallback state semantics unchanged (loading/empty/error behavior preserved).
- [x] Updated `src/components/PRViewer.summary.test.tsx` assertions for orientation-only and orientation+focus-area panelized rendering.
- [x] Validation run completed with `npm run lint && npm run build && npm run test`.

## OpenSpec Explore Decision Updates (2026-03-16)

- [x] Clarified `repository-watcher` UX scope: `repo-pr-list` renders in the left `PR Review` pane (not center chat area or right PR viewer pane).
- [x] Captured sidebar navigator behavior: controls/watchlist view and repo list view with explicit Back action.
- [x] Captured `Load PR` behavior parity with demo mode: when PR number is provided, show a list containing one selected PR.
- [x] Updated change artifacts (`proposal.md`, `design.md`, `tasks.md`, `specs/repo-pr-list/spec.md`, `specs/watched-repos/spec.md`) to reflect the decision.

## OpenSpec Implementation Updates (2026-03-16)

- [x] Implemented `repository-watcher` change tasks end-to-end.
- [x] Added watched repository state and persistence via `src/store/slices/watchedReposSlice.ts`.
- [x] Added repository PR list loading in `src/store/slices/prsSlice.ts` using existing `listPullRequests()` integration.
- [x] Added sidebar repo-list UI mode with Back navigation and new `src/components/PRList.tsx` component.
- [x] Updated sidebar to support optional PR number flow (`Load PR` vs `Load All PRs`) and watchlist interactions.
- [x] Added tests for watched repos, repository PR list loading, and sidebar list selection flows.
- [x] Validation run completed with `npm run lint && npm run build && npm run test`.

## OpenSpec Spec Sync Updates (2026-03-16)

- [x] Synced change `repository-watcher` delta specs into new main specs for `repo-pr-list` and `watched-repos`.
- [x] Created `openspec/specs/repo-pr-list/spec.md` from `openspec/changes/repository-watcher/specs/repo-pr-list/spec.md`.
- [x] Created `openspec/specs/watched-repos/spec.md` from `openspec/changes/repository-watcher/specs/watched-repos/spec.md`.

---

## Code Review Hardening Tasks (2026-03-17)

- [x] Task 1: Add stale-response guards in `prsSlice` so older PR resource responses cannot overwrite newer selection state.
- [x] Task 2: Add regression tests for rapid PR switching race in `src/store/slices/prsSlice.test.ts`.
- [x] Task 3: Add `Dialog.Description` in `src/components/SettingsDialog.tsx` to satisfy Radix dialog accessibility contract.
- [x] Task 4: Update settings dialog tests to assert description semantics and eliminate warning output.
- [x] Task 5: Add chat stream request cancellation (`AbortController`) in `src/components/ChatWindow.tsx` and `src/services/llm.ts`.
- [x] Task 6: Add tests for stream cancellation behavior and UI streaming state cleanup.

## Distribution and Release Automation (2026-03-17)

- [x] Added multi-stage Docker image build with static asset runtime (`Dockerfile`) and SPA-safe nginx config (`nginx.conf`).
- [x] Added `.dockerignore` and npm helper scripts (`docker:build`, `docker:run`) for local image usage.
- [x] Added release-triggered GHCR publish workflow (`.github/workflows/docker-release.yml`) with semver-distance tagging (`vX.Y.Z-N`) and fallback (`v0.0.0-N`).
- [x] Updated CI workflow (`.github/workflows/build.yml`) to run lint, tests, and production build.
- [x] Updated `README.md` with local Docker usage, GHCR usage, tagging semantics, and distribution alternatives.

## LLM Key Warning Cleanup (2026-03-18)

- [x] Verified non-OK LLM provider responses (including 4xx) are thrown by `LLMService` and surfaced in chat error bubbles.
- [x] Removed chat footer warning that required configuring an LLM key in settings.
- [x] Added tests to lock behavior for optional API key UI and 4xx error surfacing.

## Frontend Bundle Split Pass 1 (2026-03-18)

- [x] Extracted assistant markdown + syntax highlighting rendering into lazy-loaded `src/components/AssistantMarkdown.tsx`.
- [x] Updated `ChatWindow` to load assistant markdown renderer via `React.lazy` and `Suspense`.
- [x] Added lightweight fallback UI in assistant bubbles while markdown chunk loads.

## Frontend Bundle Split Follow-ups (OPEN)

- [ ] Pass 2: Lazy-load PR summary markdown rendering path in `src/components/PRViewer.tsx` (`SummaryPanel`) to reduce initial bundle size further.
- [ ] Split syntax highlighting payload in `src/components/AssistantMarkdown.tsx` (language/style loading strategy) to shrink lazy chunk size.
- [ ] Evaluate `vite.config.ts` manual chunking (`build.rollupOptions.output.manualChunks`) for stable vendor chunk boundaries and improved cacheability.

## Effect Migration - Phase 1 (COMPLETED 2026-03-19)

Goal: introduce Effect on one narrow PR-loading path without changing app architecture or user-visible behavior.

- [x] Add `effect` dependency and create `src/effect/runtime.ts` with a single shared runtime helper (`runEffect`).
- [x] Define a small typed error model for the pilot path in `src/effect/errors.ts` (GitHub API error passthrough + unexpected error wrapper).
- [x] Implement one Effect workflow in `src/effect/loadPullRequestContext.ts` that composes existing GitHub service calls (PR, files, comments, review comments, reviews, commits) with timeout/retry policy.
- [x] Wire `loadPullRequestContext` into existing thunk flow in `src/store/slices/prsSlice.ts` via `runEffect`, keeping reducers/selectors/state shape unchanged.
- [x] Add focused tests for success/failure/timeout parity with current behavior in `src/store/slices/prsSlice.test.ts` (or adjacent Effect unit tests).
- [x] Update docs (`README.md` + `plans/plan.md`) with scope boundaries: "Effect used for pilot orchestration only; no full migration yet."

Exit criteria:
- One PR-loading path uses Effect end-to-end.
- Existing UI behavior and Redux state contracts remain stable.
- Lint, test, and type/build checks pass.

## Effect Migration - Phase 1.5 (COMPLETED 2026-03-19)

- [x] Unified GitHub thunk error mapping through `src/effect/errors.ts::toRejectedErrorData` for legacy PR thunks in `src/store/slices/prsSlice.ts`.
- [x] Reused the same mapper in `src/store/slices/watchedReposSlice.ts` with context-specific fallback message.
- [x] Removed duplicated slice-local `toRejectedError` helpers to keep rejected payload behavior consistent across legacy and Effect-backed paths.

## Effect Migration - Phase 1.6 (COMPLETED 2026-03-19)

- [x] Removed redundant per-resource PR-loading thunks from `src/store/slices/prsSlice.ts` (`fetchPullRequest`, `fetchPRFiles`, `fetchPRComments`, `fetchPRReviewComments`, `fetchPRReviews`, `fetchPRCommits`).
- [x] Removed obsolete per-resource reducer handlers and retained unified `fetchPullRequestContext` loading state handling.
- [x] Updated tests/docs to use the single PR context loading entrypoint.

## Effect Migration - Phase 1.7 (COMPLETED 2026-03-19)

- [x] Refined Effect retry behavior in `src/effect/loadPullRequestContext.ts` to retry only transient failures (`TimeoutError`, `NETWORK_ERROR`, `RATE_LIMITED`).
- [x] Added Effect unit tests to verify deterministic errors are not retried and transient failures are retried.

## Docker Release Workflow Runtime Update (COMPLETED 2026-03-20)

- [x] Updated `.github/workflows/docker-release.yml` action majors to Node 24-compatible versions: `actions/checkout@v5`, `docker/setup-buildx-action@v4`, `docker/login-action@v4`, `docker/build-push-action@v7`.
- [x] Added workflow-level opt-in `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true` for early compatibility with GitHub Actions runtime migration.
- [x] Validation run completed with `npm run lint -- --max-warnings=0 && npm run build && npm run test`.

## Docker Release Pull Command Output (COMPLETED 2026-03-20)

- [x] Added a post-publish step in `.github/workflows/docker-release.yml` that prints the exact `docker pull` commands for both release and SHA tags in workflow logs.
- [x] Added the same pull commands to `$GITHUB_STEP_SUMMARY` so they are easy to copy from the run summary page.

## OpenSpec Proposal Updates (2026-03-20)

- [x] Created change `openspec/changes/add-diff-intelligence-layer/` with proposal, design, capability specs, and implementation tasks.
- [x] Added new capability spec delta `openspec/changes/add-diff-intelligence-layer/specs/diff-intelligence/spec.md`.
- [x] Added `pr-review-summary` delta for diff-grounded summary references in `openspec/changes/add-diff-intelligence-layer/specs/pr-review-summary/spec.md`.
- [x] Created change `openspec/changes/add-ci-and-code-scanning-signal-fusion/` with proposal, design, capability specs, and implementation tasks.
- [x] Added new capability spec delta `openspec/changes/add-ci-and-code-scanning-signal-fusion/specs/pr-signal-fusion/spec.md`.
- [x] Added `pr-review-summary` delta for CI/code-scanning signal-aware summary guidance in `openspec/changes/add-ci-and-code-scanning-signal-fusion/specs/pr-review-summary/spec.md`.
