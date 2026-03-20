# PR Review Chatbot - Agent Instructions

## Project Overview

This is a standalone React + TypeScript webapp that acts as a chatbot interface for reviewing and asking questions about GitHub Pull Requests. It uses an LLM (via OpenAI v1 API or LiteLLM Proxy) to answer questions about PR content.

## Tech Stack

- **Vite** + **React 18** + **TypeScript**
- **Redux Toolkit** for state management
- **Tailwind CSS** for styling
- **Radix UI** for accessible components
- **Axios** for HTTP (GitHub API)
- **Effect** for phase-1 PR context orchestration
- **react-markdown** + **react-syntax-highlighter** for message rendering

## Project Structure

```
src/
├── App.tsx                    # Root component with layout
├── main.tsx                   # Entry point with Redux Provider
├── index.css                  # Tailwind + CSS variables
├── vite-env.d.ts              # Vite environment type declarations
├── types/
│   └── index.ts               # All TypeScript interfaces
├── store/
│   ├── index.ts               # Redux store configuration
│   ├── hooks.ts               # Typed useAppDispatch / useAppSelector
│   └── slices/
│       ├── configSlice.ts     # App config (env vars + localStorage overrides)
│       ├── chatSlice.ts       # Chat messages + streaming state
│       ├── prsSlice.ts        # Selected PR data + repo PR lists + commits + summary lifecycle state
│       └── watchedReposSlice.ts # Watched repositories + PR count badges (localStorage)
├── services/
│   ├── llm.ts                 # LLM service (OpenAI v1 API + LiteLLM, streaming)
│   ├── github.ts              # GitHub API service (github.com + GHES)
│   ├── summary.ts             # Summary cache/rate-limit/empty-diff utilities
│   └── dummyData.ts           # Sample PR data for demo mode
├── components/
│   ├── Sidebar.tsx            # Demo toggle + watchlist + controls/list sidebar views
│   ├── PRList.tsx             # Sidebar repository PR list view with back navigation
│   ├── ChatWindow.tsx         # Chat interface with streaming
│   ├── PRViewer.tsx           # PR details, summary tab, diffs, comments, reviews
│   └── SettingsDialog.tsx     # Runtime configuration override + summary controls
└── lib/
    └── utils.ts               # cn(), formatDate(), generateId()
```

## Key Features

### Demo Mode (Default)
- Pre-loaded with a sample JWT authentication PR
- No GitHub credentials required
- Toggle in sidebar or Settings dialog
- Allows immediate LLM interaction

### LLM Integration
- Supports **OpenAI v1 API** and **LiteLLM Proxy** (same API format)
- Streaming responses via Server-Sent Events
- PR context injected as system prompt (PR metadata, diffs, comments, reviews)
- Configurable endpoint, model, and API key
- API key is optional for providers/endpoints that do not require auth
- HTTP API failures (including provider 4xx errors) are surfaced in assistant message bubbles
- Assistant markdown rendering (markdown + syntax highlighting) is lazy-loaded to reduce initial bundle cost; chat shows a lightweight fallback while that chunk loads
- Separate summary prompt assembly path (`buildSummaryPrompt`) for orientation-first PR kickoff summaries

### GitHub Integration
- PAT (Personal Access Token) authentication
- Supports **github.com** and **GitHub Enterprise Server (GHES)**
- GHES base URL: `https://<host>/api/v3`
- Manual GitHub mode input in sidebar: `owner/repo` + optional PR number
- Sidebar supports `Load PR` (single selected list item) and `Load All PRs` (repository list)
- Watch repositories in sidebar and display open PR count badges
- Fetches: PR metadata, file diffs, issue comments, review comments, reviews, commit messages
- Refresh actions re-fetch currently selected PR, repository lists, and watched repo PR counts
- User-friendly GitHub API errors (auth, not found, rate limit, network)

### Settings
- Runtime override of all configuration
- Persisted to `localStorage`
- Defaults from environment variables (`VITE_*`)
- Includes summary controls (`summaryEnabled`, editable `summaryPrompt`, optional `summaryCommands`, reset prompt)

### PR Summary Flow
- Summary generation triggers on PR selection/load when `summaryEnabled` is true
- Summary state is isolated from chat state (`prsSlice.summary`)
- Fallback states:
  - `Nothing to Summarize` when no textual diffs exist
  - `Unable to generate summary` on generation failure
- Uses session-scoped cache and one-per-minute per-PR-head rate limit
- Summary output contract:
  - 2-4 line orientation section
  - adaptive `Focus Areas` (`0..4`)
  - each focus area includes where/why/what-to-verify

## Environment Variables

```bash
VITE_GITHUB_PAT=          # GitHub Personal Access Token
VITE_LLM_API_KEY=         # LLM API Key
VITE_GITHUB_INSTANCE=github.com  # "github.com" or GHES hostname
VITE_LLM_BACKEND=openai   # "openai" or "litellm"
VITE_LLM_ENDPOINT=https://api.openai.com/v1
VITE_LLM_MODEL=gpt-4o
VITE_DEMO_MODE=true
VITE_SUMMARY_ENABLED=true
VITE_SUMMARY_COMMANDS=
```

## Development

```bash
npm install       # Install dependencies
npm run dev       # Start dev server (http://localhost:5173)
npm run lint      # Run ESLint (flat config in eslint.config.js)
npm run build     # TypeScript check + production build
npm run preview   # Preview production build
npm run docker:build # Build Docker image locally
npm run docker:run   # Run Docker image locally on :8080
```

## CI/CD and Distribution

- CI workflow: `.github/workflows/build.yml`
  - Runs `npm ci`, `npm run lint`, `npm test`, and `npm run build` on pushes/PRs to `main`.
- Docker release workflow: `.github/workflows/docker-release.yml`
  - Triggers on GitHub Release `published`.
  - Publishes image to `ghcr.io/<owner>/<repo>`.
  - Computes image tags as semver-distance:
    - primary: `vX.Y.Z-N` (latest reachable semver tag + commit distance)
    - fallback: `v0.0.0-N` when no semver tags exist
    - traceability: `sha-<shortsha>`
- Docker runtime setup:
  - `Dockerfile` uses multi-stage Node build + nginx runtime.
  - `nginx.conf` serves SPA routes via `try_files ... /index.html`.
  - `.dockerignore` excludes local build, VCS, and env artifacts from build context.

## Common Tasks for AI Agents

### Adding a new Redux slice
1. Create `src/store/slices/<name>Slice.ts` following the pattern in existing slices
2. Add the reducer to `src/store/index.ts`
3. Export typed selectors using `useAppSelector`

### Adding a new component
1. Create `src/components/<Name>.tsx`
2. Use `useAppSelector` and `useAppDispatch` from `src/store/hooks.ts`
3. Use `cn()` from `src/lib/utils.ts` for conditional class names
4. Follow Tailwind CSS + CSS variable pattern for theming

### Modifying the LLM system prompt
- Edit `buildSystemPrompt()` in [`src/services/llm.ts`](src/services/llm.ts)
- The method receives a `PRContext` object with `pr`, `files`, `comments`, `reviewComments`, `reviews`
- Prompt construction uses a deterministic character budget for very large PRs and emits an omission summary when some diffs are excluded

### Modifying summary behavior
- Summary orchestration policy lives in [`src/services/summary.ts`](src/services/summary.ts)
- Summary state transitions and async generation thunk live in [`src/store/slices/prsSlice.ts`](src/store/slices/prsSlice.ts)
- Summary prompt contract lives in `buildSummaryPrompt()` in [`src/services/llm.ts`](src/services/llm.ts)
- Summary UI rendering lives in [`src/components/PRViewer.tsx`](src/components/PRViewer.tsx)

### Adding GitHub API endpoints
- Add methods to the `GitHubService` class in [`src/services/github.ts`](src/services/github.ts)
- The service automatically handles github.com vs GHES URL routing
- Prefer using the centralized GitHub error parsing (`parseGitHubError`) and `GitHubApiError` for consistent UI-friendly failures
- For thunk rejected payloads, prefer `toRejectedErrorData` in `src/effect/errors.ts` to keep all slice paths consistent

### GitHub data loading flow
- `prsSlice` uses Effect-backed full-context loading for PR selection:
  - `fetchPullRequestContext` (uses `src/effect/loadPullRequestContext.ts` via `runEffect`)
- Retry policy in `loadPullRequestContext` is transient-only (timeouts/network/rate-limit) to avoid retrying deterministic failures like 404/auth errors
- Use `loadingByResource` and `errorByResource` for UI state; legacy aggregate `isLoading` and `error` are still populated for compatibility

### Active OpenSpec context
- Active change: `openspec/changes/repository-watcher`
- Main specs synced for this change:
  - `openspec/specs/repo-pr-list/spec.md`
  - `openspec/specs/watched-repos/spec.md`
- Repository watcher behavior target:
  - left `PR Review` pane supports two views: controls/watchlist and repo PR list
  - `Load PR` with a PR number switches to list view with one selected PR (demo-like behavior)
  - watched repo click opens that repo list in the same pane
  - list view includes Back action to return to controls/watchlist

### Modifying dummy data
- Edit [`src/services/dummyData.ts`](src/services/dummyData.ts)
- The `dummyPRContext` export is used by `ChatWindow` and `Sidebar` in demo mode

## Architecture Notes

### State Flow
```
User types message
  → ChatWindow dispatches addMessage (user)
  → ChatWindow dispatches addMessage (assistant, isStreaming: true)
  → LLMService.chatStream() yields chunks
  → ChatWindow dispatches appendStreamingContent for each chunk
  → ChatWindow dispatches finalizeStreamingMessage when done
```

### Config Priority
```
localStorage override > environment variable > hardcoded default
```

### GHES URL Construction
```typescript
// github.com → https://api.github.com
// mycompany.com → https://mycompany.com/api/v3
```

## Known Limitations / Future Work

- No pagination for PR lists
- No OAuth flow (PAT only)
- No conversation persistence across page reloads
