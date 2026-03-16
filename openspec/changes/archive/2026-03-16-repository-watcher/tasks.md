## 1. Type Definitions

- [x] 1.1 Add `WatchedRepository` type to `src/types/index.ts`
- [x] 1.2 Add `PRListItem` type to `src/types/index.ts`

## 2. Redux State Management

- [x] 2.1 Add `watchedRepos` slice to store/slices/ (or extend configSlice)
- [x] 2.2 Add async thunk to fetch PR count for a repository
- [x] 2.3 Add reducers: addWatchedRepo, removeWatchedRepo, setPRList
- [x] 2.4 Persist watched repos to localStorage

## 3. Sidebar UI

- [x] 3.1 Add watch icon button next to repository input field
- [x] 3.2 Add watched repos list below the PR loader
- [x] 3.3 Add refresh button per watched repo
- [x] 3.4 Add remove button per watched repo
- [x] 3.5 Change button text based on PR number presence
- [x] 3.6 Add sidebar view state: controls view and repo list view
- [x] 3.7 Add Back action from repo list view to controls/watchlist view

## 4. PR List Component

- [x] 4.1 Create `src/components/PRList.tsx` component for sidebar repo list view
- [x] 4.2 Display list of PRs with number, title, author, time
- [x] 4.3 Handle click to select PR and show details in right PR viewer pane
- [x] 4.4 When `Load PR` includes PR number, show repo list with one selected PR (demo-like behavior)
- [x] 4.5 When clicking watched repo, switch sidebar to repo list view for that repository

## 5. PRViewer Integration

- [x] 5.1 Keep PRViewer detail-only (no list mode)
- [x] 5.2 Ensure selecting PR from sidebar repo list drives existing PRViewer detail loading

## 6. GitHub Service

- [x] 6.1 Verify listPullRequests() works (already exists)
- [x] 6.2 No changes expected, but verify integration

## 7. Testing

- [x] 7.1 Test adding/removing watched repos
- [x] 7.2 Test persistence after page reload
- [x] 7.3 Test loading all PRs from a repository
- [x] 7.4 Test selecting PR from list shows details

## 8. Error Handling

- [x] 8.1 Handle invalid repository names gracefully
- [x] 8.2 Handle API errors when fetching PRs
- [x] 8.3 Show appropriate loading states
