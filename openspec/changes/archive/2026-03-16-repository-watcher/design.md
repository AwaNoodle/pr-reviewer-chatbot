## Context

This is a web application (React + Redux) that allows users to review GitHub PRs. Currently users must manually enter a full PR URL each time. The feature adds repository watching and PR list display.

## Goals / Non-Goals

**Goals:**
- Add watched repositories list to sidebar with add/remove functionality
- Persist watched repos in localStorage
- Make PR number optional - load all PRs from a repo when empty
- Add PR list view in the left `PR Review` pane, with back navigation to the controls/watchlist view

**Non-Goals:**
- Real-time polling (manual refresh only)
- Notification system
- Filtering PRs by requested reviewer
- Webhook-based updates (would require server-side)

## Decisions

### 1. Storage: localStorage

Using localStorage (same as existing config) rather than Redux persist or a new backend service.

- **Rationale**: Simple, works with current architecture, no server changes needed
- **Alternative**: Redux persist - adds dependency, more complex

### 2. Badge: Total open PRs

Displaying total count of open PRs rather than "unread" tracking.

- **Rationale**: Simpler to implement, sufficient for MVP
- **Alternative**: Unread tracking - would require storing seen PR IDs per repo

### 3. PR List: Separate component from PRViewer

Creating a new `PRList` component rather than modifying `PRViewer`.

- **Rationale**: Keeps PRViewer focused on single PR detail, cleaner separation
- **Alternative**: Modify PRViewer to handle both - would add complexity

### 4. Watch icon: Immediate add on click

Adding repo to watch list immediately when clicking the watch icon.

- **Rationale**: Simpler UX, user can easily remove if added by mistake
- **Alternative**: Confirmation dialog - adds friction

### 5. Sidebar navigation: two views in the same pane

The left `PR Review` pane will behave as a small navigator with two views:

- **Controls view**: repository input, optional PR number input, load button, watchlist
- **Repo list view**: list of PRs for the active repository, plus a Back action

Behavior details:

- Clicking **Load PR** with a PR number switches to repo list view containing one selected PR (demo-like behavior)
- Clicking **Load All PRs** (empty PR number) switches to repo list view containing all open PRs
- Clicking a watched repository switches to repo list view for that repository
- Back returns to controls view and keeps form inputs intact

- **Rationale**: Matches existing demo mode mental model and keeps repository workflows in one consistent sidebar location
- **Alternative**: Render PR list in center chat area or right PR detail pane, which fragments navigation and blurs responsibility

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| GitHub API rate limits when fetching PR counts for many repos | Limit number of watched repos (reasonable for personal use) |
| Invalid repos entered by user | Validate via API before adding, show error |
| Large number of PRs in a repo | Pagination in list view if needed |
| No real-time updates | Manual refresh only for MVP |
| Users may miss how to return from repo list view | Add visible Back action at top of repo list view |
