## Requirements

### Requirement: Assistant Claims Are Diff-Grounded
The system SHALL represent non-trivial assistant claims with one or more structured references to the current pull request diff.

#### Scenario: Claim includes at least one reference
- **WHEN** the assistant emits a claim about risk, behavior, or correctness in summary or chat output
- **THEN** the claim SHALL include at least one reference containing file path
- **AND** the reference MAY include a line range or hunk/snippet anchor when available.

### Requirement: Citation Navigation in Reviewer UI
The system SHALL allow users to navigate from a rendered citation to the relevant location in the pull request files view.

#### Scenario: User opens citation target
- **WHEN** a user clicks a citation associated with an assistant claim
- **THEN** the system SHALL activate the Files view
- **AND** expand the referenced file
- **AND** scroll or focus to the best matching referenced hunk or line region.

#### Scenario: Citation target cannot be resolved exactly
- **WHEN** the reference cannot be resolved to an exact line position
- **THEN** the system SHALL still open the referenced file
- **AND** indicate that an exact anchor could not be resolved.

### Requirement: Citation Quality Visibility
The system SHALL distinguish cited and uncited assistant content in the UI.

#### Scenario: Uncited claim rendering
- **WHEN** assistant output includes a claim without any reference data
- **THEN** the system SHALL render a visible uncited or low-confidence indicator for that claim.
