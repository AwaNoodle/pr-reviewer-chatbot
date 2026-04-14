## Requirements

### Requirement: Automatic Summary Generation on PR Selection
The system SHALL generate a reviewer-orientation summary when a pull request is selected and summary generation is enabled.

#### Scenario: Summary generated for selected PR
- **WHEN** a user selects a PR and summary generation is enabled
- **THEN** the system SHALL request a summary using PR description, PR commit messages, and textual code changes as context.

#### Scenario: Summary generation disabled
- **WHEN** a user selects a PR and summary generation is disabled
- **THEN** the system SHALL not request or refresh summary content.

### Requirement: Summary Uses Existing LLM Configuration
The system SHALL use the existing LLM backend configuration for summary generation.

#### Scenario: Summary request uses configured LLM settings
- **WHEN** a summary request is issued
- **THEN** the request SHALL use the currently configured `llmBackend`, `llmEndpoint`, `llmApiKey`, and `llmModel` values.

### Requirement: Summary Prompt Is Configurable and Persisted
The system SHALL allow users to edit the summary prompt, persist it across sessions, and reset only the prompt to the default value.

#### Scenario: Prompt edits persist
- **WHEN** a user saves changes to the summary prompt in Settings
- **THEN** the system SHALL persist the updated prompt and reuse it for future summary generation.

#### Scenario: Reset restores default prompt only
- **WHEN** a user chooses Reset Prompt in Settings
- **THEN** the system SHALL restore only the summary prompt to the default text and SHALL NOT modify additional summary commands.

### Requirement: Additional Summary Commands Are Supported
The system SHALL allow optional additional summary commands configured by the user and append them to summary-generation instructions.

#### Scenario: Commands appended to summary prompt
- **WHEN** one or more summary commands are configured
- **THEN** the system SHALL append those commands to summary-generation instructions for the selected PR.

### Requirement: Summary Output Contract
The generated summary SHALL follow a structured response contract suitable for reviewer orientation and include diff-grounded references for non-trivial claims.

#### Scenario: Orientation-first summary format
- **WHEN** summary instructions are sent to the LLM
- **THEN** the instructions SHALL require a concise orientation section of 2-4 lines.

#### Scenario: Adaptive focus areas with cap
- **WHEN** summary instructions are sent to the LLM
- **THEN** the instructions SHALL allow adaptive `Focus Areas` inclusion based on meaningful risk/complexity/churn signals
- **AND** the number of focus areas SHALL be capped at 4.

#### Scenario: No focus areas for simple PRs
- **WHEN** the PR is simple and no meaningful risk/complexity/churn signals are detected
- **THEN** the summary MAY omit `Focus Areas`
- **AND** this SHALL be considered a valid successful summary outcome.

#### Scenario: Focus area content shape
- **WHEN** one or more focus areas are emitted
- **THEN** each focus area SHALL include: where to review, why it matters, and what to verify.

#### Scenario: Focus area includes diff references
- **WHEN** a focus area presents a non-trivial risk, behavior, or correctness claim
- **THEN** the output SHALL include at least one diff-grounded reference for that focus area.

### Requirement: Summary Is Separate from Chat History
Summary content SHALL be isolated from chat history and SHALL NOT be included in subsequent LLM chat context.

#### Scenario: Summary excluded from chat context
- **WHEN** a user sends a chat message after summary generation
- **THEN** the outbound chat context SHALL NOT include summary content as a prior message or system/context segment.

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

### Requirement: Per-PR Rate Limiting and Session Cache
The system SHALL limit summary generation to one request per minute per PR and cache generated summaries in session storage.

#### Scenario: Per-PR one-minute generation limit
- **WHEN** a summary was generated for a PR less than one minute ago
- **THEN** the system SHALL NOT issue another summary generation request for that same PR during the one-minute window.

#### Scenario: Cached summary reuse
- **WHEN** a cached summary exists in session storage for the current PR and summary prompt fingerprint
- **THEN** the system SHALL reuse the cached summary content and generated timestamp instead of issuing a new summary request.
