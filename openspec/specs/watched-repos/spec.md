## Requirements

### Requirement: User can add a repository to watch list
The system SHALL allow users to add a GitHub repository to their watched repositories list by clicking a watch icon next to the repository input field.

#### Scenario: Add valid repository to watch list
- **WHEN** user enters a valid "owner/repo" in the repository input field
- **AND** clicks the watch icon button
- **THEN** the repository SHALL be added to the watched repos list
- **AND** the watch icon SHALL indicate the repository is being watched (filled icon)

#### Scenario: Cannot add invalid repository
- **WHEN** user enters an invalid or non-existent repository
- **AND** clicks the watch icon
- **THEN** the system SHALL display an error message
- **AND** the repository SHALL NOT be added to the watch list

### Requirement: User can remove a repository from watch list
The system SHALL allow users to remove a repository from their watched list.

#### Scenario: Remove repository from watch list
- **WHEN** user clicks the remove (X) button next to a watched repository
- **THEN** the repository SHALL be removed from the watched list

### Requirement: Watch list persists across sessions
The system SHALL persist the watched repositories list in localStorage.

#### Scenario: Watched repos persist after page reload
- **WHEN** user has added repositories to their watch list
- **AND** reloads the page
- **THEN** the watched repositories SHALL be restored from localStorage

### Requirement: Watched repos show PR count badge
The system SHALL display a badge showing the count of open PRs for each watched repository.

#### Scenario: Badge shows open PR count
- **WHEN** watched repositories are displayed
- **THEN** each repository SHALL show a badge with the count of open PRs
- **AND** the count SHALL be fetched from the GitHub API when the sidebar loads or refresh is clicked

### Requirement: User can open a watched repository PR list in-place
The system SHALL open repository PR list view in the same left `PR Review` pane when a watched repository is selected.

#### Scenario: Open watched repository PR list
- **WHEN** user clicks a watched repository item
- **THEN** the system SHALL switch the left `PR Review` pane to PR list view for that repository
- **AND** display open PRs for that repository
