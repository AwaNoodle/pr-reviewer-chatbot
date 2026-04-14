## MODIFIED Requirements

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
