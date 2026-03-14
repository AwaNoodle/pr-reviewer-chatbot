## Why

Reviewers currently have to manually scan PR metadata, file diffs, and comments before they can ask useful questions. A generated kickoff summary provides fast orientation and helps reviewers focus on high-risk areas immediately.

## What Changes

- Add an optional, auto-generated PR summary flow that runs when a PR is selected and is enabled by default.
- Add a new `Summary` tab in the right-hand PR viewer pane with loading, success, empty, and failure states.
- Make the summary prompt user-editable in Settings, persist it between sessions, and provide a reset action that restores the default prompt only.
- Allow optional additional summary commands from Settings and append them to the summary prompt.
- Keep summary output separate from chat history and exclude it from subsequent LLM chat context.
- Add per-PR summary generation rate limiting (one request per minute) and sessionStorage caching.
- Show a generation timestamp at the bottom of the Summary pane.
- Fetch and include PR commit messages as summary context.

## Capabilities

### New Capabilities
- `pr-review-summary`: Generate and display reviewer-oriented PR summaries with configurable prompt behavior, caching, and guarded fallback states.

### Modified Capabilities
- None.

## Impact

- Affected frontend areas: `src/components/PRViewer.tsx`, `src/components/SettingsDialog.tsx`, `src/store/slices/configSlice.ts`, `src/store/slices/prsSlice.ts`, `src/services/llm.ts`, `src/services/github.ts`, and related tests.
- Adds summary-specific state management and sessionStorage cache handling for per-PR summary payloads and generation timestamps.
- Adds one GitHub API integration path for PR commit messages to enrich summary context.
