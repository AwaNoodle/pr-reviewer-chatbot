## ADDED Requirements

### Requirement: CI and Check Signals Are Fetched for Selected PR
The system SHALL fetch CI/status and check-run signals for the selected pull request head SHA.

#### Scenario: Load signals after PR selection
- **WHEN** a pull request is selected in GitHub mode
- **THEN** the system SHALL request check/status signal data scoped to that PR head SHA.

#### Scenario: Refresh reloads signals
- **WHEN** a user refreshes the selected pull request
- **THEN** the system SHALL re-fetch signal data for the current head SHA.

### Requirement: Signals Are Presented with Clear State Semantics
The system SHALL present signal outcomes with distinct visual states for success, failure, pending, unavailable, and error conditions.

#### Scenario: Display failing and pending signal highlights
- **WHEN** one or more CI/check signals are failing or pending
- **THEN** the UI SHALL display failing and pending counts
- **AND** list the corresponding signal names.

#### Scenario: Display unavailable signal source
- **WHEN** a signal source cannot be accessed due to missing permissions or unsupported repository settings
- **THEN** the UI SHALL indicate that source as unavailable
- **AND** SHALL NOT present it as a successful empty state.

### Requirement: Signal Data Is Included in Reviewer Context
The system SHALL include normalized signal data in assistant context used for review guidance.

#### Scenario: Signal context available to assistant
- **WHEN** signal data fetch succeeds
- **THEN** summary and chat context construction SHALL include normalized signal highlights relevant to reviewer prioritization.
