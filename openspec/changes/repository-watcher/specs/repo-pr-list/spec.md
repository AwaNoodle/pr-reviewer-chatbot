## ADDED Requirements

### Requirement: PR Number field is optional
The system SHALL allow loading PRs without specifying a PR number.

#### Scenario: Load all PRs without PR number
- **WHEN** user enters a repository in the repository input field
- **AND** leaves the PR Number field empty
- **AND** clicks "Load All PRs"
- **THEN** the system SHALL fetch all open PRs from that repository
- **AND** display them in a PR list view

### Requirement: User can view list of PRs from a repository
The system SHALL display a list of PRs when loaded without a specific PR number.

#### Scenario: Display PR list in main view
- **WHEN** user has loaded all PRs from a repository
- **THEN** the main view SHALL show a list of PRs
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
