## Why

Currently users must manually enter a full PR URL each time they want to review a PR. There's no way to track repositories of interest or see PRs from those repos without being explicitly tagged or watching the repo on GitHub. Adding repository watching enables a passive feed of PRs from repos the user cares about.

## What Changes

- Add watched repos list to sidebar, persisted in localStorage
- Make PR Number field optional in the PR loader
- Load all PRs from a repo when PR Number is empty
- Add PR list view in main area to display multiple PRs when loaded without a specific PR number
- Add watch toggle button next to repository input field

## Capabilities

### New Capabilities

- `watched-repos`: Store and manage list of repositories to watch for PRs
- `repo-pr-list`: Display a list of PRs from a repository when no specific PR is selected

### Modified Capabilities

- `pr-loader`: Extend to support loading all PRs from a repo (not just a specific PR)

## Impact

- **Sidebar**: Add watched repos list, watch toggle icon on repo input
- **PRViewer**: Support list view mode alongside detail view
- **Config**: Add watched repos storage in localStorage
- **GitHub Service**: Already has `listPullRequests()` - no changes needed
