## ADDED Requirements

### Requirement: CI and Check Signals Are Fetched for Selected PR
The system SHALL fetch CI/status and check-run signal context for the selected pull request head SHA.

#### Scenario: Load signals after PR selection
- **WHEN** a pull request is selected in GitHub mode
- **THEN** the system SHALL request check/status signal context scoped to that PR head SHA.

#### Scenario: Refresh reloads signals
- **WHEN** a user refreshes the selected pull request
- **THEN** the system SHALL re-fetch signal context for the current head SHA.

#### Scenario: Head SHA change invalidates prior signal data
- **WHEN** the selected pull request head SHA changes
- **THEN** the system SHALL invalidate previously cached signal context
- **AND** SHALL fetch signal context scoped to the new head SHA.

### Requirement: Code-Scanning Signals Are Fetched for Selected PR
The system SHALL fetch code-scanning signal context for the selected pull request head SHA when available.

#### Scenario: Load code-scanning signals after PR selection
- **WHEN** a pull request is selected in GitHub mode
- **THEN** the system SHALL request code-scanning signal context scoped to that PR head SHA.

#### Scenario: Handle code-scanning permission limits
- **WHEN** code-scanning endpoints cannot be accessed due to permissions or repository configuration
- **THEN** the system SHALL represent code-scanning as unavailable
- **AND** SHALL NOT represent it as a successful empty result.

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

### Requirement: Signal Context Is Included in Reviewer Context
The system SHALL include normalized signal context in assistant context used for review guidance.

#### Scenario: Signal context available to assistant
- **WHEN** signal context fetch succeeds
- **THEN** summary and chat context construction SHALL include normalized signal highlights relevant to reviewer prioritization.

### Requirement: Signal Context Is Bounded and Deterministic
The system SHALL include bounded, deterministic signal highlights in assistant context.

#### Scenario: Prompt context uses top-N signal highlights
- **WHEN** signal context is prepared for summary or chat
- **THEN** the system SHALL include only top-N normalized highlights per category
- **AND** SHALL apply deterministic ordering rules.

#### Scenario: Prompt context omits raw signal payloads
- **WHEN** signal context is prepared for assistant prompts
- **THEN** the system SHALL exclude raw endpoint payload bodies
- **AND** include reviewer-oriented normalized fields instead.

### Requirement: Signal Fusion Is Channel-Aware
The system SHALL use channel-specific signal detail levels for summary generation and chat context.

#### Scenario: Summary uses richer signal highlights
- **WHEN** building summary-generation context
- **THEN** the system SHALL include richer normalized signal highlights suitable for reviewer triage.

#### Scenario: Chat uses compact signal snapshot
- **WHEN** building chat system context
- **THEN** the system SHALL include a compact signal snapshot
- **AND** prioritize preserving diff/review context budget.
