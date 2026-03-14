## 1. Type Definitions

- [ ] 1.1 Add `WatchedRepository` type to `src/types/index.ts`
- [ ] 1.2 Add `PRListItem` type to `src/types/index.ts`

## 2. Redux State Management

- [ ] 2.1 Add `watchedRepos` slice to store/slices/ (or extend configSlice)
- [ ] 2.2 Add async thunk to fetch PR count for a repository
- [ ] 2.3 Add reducers: addWatchedRepo, removeWatchedRepo, setPRList
- [ ] 2.4 Persist watched repos to localStorage

## 3. Sidebar UI

- [ ] 3.1 Add watch icon button next to repository input field
- [ ] 3.2 Add watched repos list below the PR loader
- [ ] 3.3 Add refresh button per watched repo
- [ ] 3.4 Add remove button per watched repo
- [ ] 3.5 Change button text based on PR number presence

## 4. PR List Component

- [ ] 4.1 Create `src/components/PRList.tsx` component
- [ ] 4.2 Display list of PRs with number, title, author, time
- [ ] 4.3 Handle click to select PR and show details

## 5. PRViewer Integration

- [ ] 5.1 Update PRViewer to handle list vs detail view modes
- [ ] 5.2 Add "back to list" option when viewing PR details
- [ ] 5.3 Show repository name in PR list header

## 6. GitHub Service

- [ ] 6.1 Verify listPullRequests() works (already exists)
- [ ] 6.2 No changes expected, but verify integration

## 7. Testing

- [ ] 7.1 Test adding/removing watched repos
- [ ] 7.2 Test persistence after page reload
- [ ] 7.3 Test loading all PRs from a repository
- [ ] 7.4 Test selecting PR from list shows details

## 8. Error Handling

- [ ] 8.1 Handle invalid repository names gracefully
- [ ] 8.2 Handle API errors when fetching PRs
- [ ] 8.3 Show appropriate loading states
