## Requirements

### Requirement: PR Number field is optional
The system SHALL allow loading PRs without specifying a PR number.

#### Scenario: Load all PRs without PR number
- **WHEN** user enters a repository in the repository input field
- **AND** leaves the PR Number field empty
- **AND** clicks "Load All PRs"
- **THEN** the system SHALL fetch all open PRs from that repository
- **AND** display them in a PR list view in the left `PR Review` pane

#### Scenario: Load single PR into list view when PR number is present
- **WHEN** user enters a repository in the repository input field
- **AND** enters a valid PR number
- **AND** clicks "Load PR"
- **THEN** the system SHALL switch the left `PR Review` pane to PR list view
- **AND** the list SHALL contain the specified PR as a selected list item

### Requirement: User can view list of PRs from a repository
The system SHALL display a list of PRs when loaded without a specific PR number.

#### Scenario: Display PR list in left PR Review pane
- **WHEN** user has loaded all PRs from a repository
- **THEN** the left `PR Review` pane SHALL show a list of PRs
- **AND** each item SHALL display: PR number, title, author, and time since update

### Requirement: User can select a PR from the list
The system SHALL allow users to view details of a specific PR from the list.

#### Scenario: Click PR to view details
- **WHEN** user clicks on a PR in the list
- **THEN** the system SHALL switch to detail view
- **AND** show files, comments, reviews, and chat for that PR

### Requirement: Button text changes based on input
The system SHALL change the button text based on whether a PR number is entered.

#### Scenario: Button shows "Load PR" with PR number
- **WHEN** user has entered a PR number
- **THEN** the button SHALL display "Load PR"

#### Scenario: Button shows "Load All PRs" without PR number
- **WHEN** PR Number field is empty
- **THEN** the button SHALL display "Load All PRs"

### Requirement: User can navigate back to controls view
The system SHALL allow users to return from PR list view to the controls/watchlist view in the left sidebar pane.

#### Scenario: Return from PR list to controls/watchlist
- **WHEN** user is viewing repository PR list in the left `PR Review` pane
- **AND** clicks the Back action
- **THEN** the system SHALL show the controls/watchlist view in the same pane
