## MODIFIED Requirements

### Requirement: Summary Presentation in PR Viewer
The PR viewer SHALL provide a dedicated Summary tab with readable visual hierarchy, markdown legibility, responsive spacing, and metadata display.

#### Scenario: Summary tab displays loading spinner
- **WHEN** summary generation is in progress
- **THEN** the Summary tab SHALL display a spinner indicator and loading state text.

#### Scenario: Summary tab displays generated timestamp
- **WHEN** summary generation succeeds
- **THEN** the Summary tab SHALL display the summary content and a generation-time timestamp at the bottom of the pane.

#### Scenario: Readable hierarchy for generated summary
- **WHEN** summary content is rendered in the Summary tab
- **THEN** the UI SHALL present clear visual hierarchy between headings, body text, and metadata using distinct typography and spacing.

#### Scenario: Markdown content remains legible
- **WHEN** generated summary includes markdown lists, emphasis, or inline/code blocks
- **THEN** the Summary tab SHALL render those elements with readable spacing and contrast consistent with the active theme.

#### Scenario: Readability preserved on small screens
- **WHEN** the Summary tab is viewed on narrow/mobile viewport widths
- **THEN** the UI SHALL adapt spacing and text layout to avoid cramped content and horizontal overflow.

### Requirement: Empty and Failure Fallback States
The system SHALL provide explicit fallback states when summary generation is not possible, with readable and clearly differentiated messaging.

#### Scenario: Empty PR state
- **WHEN** a selected PR has no textual content to summarize
- **THEN** the system SHALL skip summary generation and display `Nothing to Summarize` in the Summary tab.

#### Scenario: LLM request failure state
- **WHEN** the system cannot reach the LLM or summary generation fails
- **THEN** the system SHALL display `Unable to generate summary` in the Summary tab.

#### Scenario: Distinct fallback visual treatment
- **WHEN** the Summary tab shows empty or error fallback content
- **THEN** the UI SHALL provide state-specific visual cues so users can distinguish empty data from request failure at a glance.
