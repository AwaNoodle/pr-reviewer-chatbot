## MODIFIED Requirements

### Requirement: Summary Output Contract
The generated summary SHALL follow a structured response contract suitable for reviewer orientation and include relevant CI/code-scanning signal context when available.

#### Scenario: Orientation-first summary format
- **WHEN** summary instructions are sent to the LLM
- **THEN** the instructions SHALL require a concise orientation section of 2-4 lines.

#### Scenario: Adaptive focus areas with cap
- **WHEN** summary instructions are sent to the LLM
- **THEN** the instructions SHALL allow adaptive `Focus Areas` inclusion based on meaningful risk/complexity/churn/signal-state indicators
- **AND** the number of focus areas SHALL be capped at 4.

#### Scenario: No focus areas for simple PRs
- **WHEN** the PR is simple and no meaningful risk/complexity/churn signals are detected
- **THEN** the summary MAY omit `Focus Areas`
- **AND** this SHALL be considered a valid successful summary outcome.

#### Scenario: Focus area content shape
- **WHEN** one or more focus areas are emitted
- **THEN** each focus area SHALL include: where to review, why it matters, and what to verify.

#### Scenario: Summary reflects high-risk signals
- **WHEN** CI/check/code-scanning signals contain failures or high-severity findings
- **THEN** the summary SHALL incorporate those signals into reviewer-oriented guidance
- **AND** prioritize those signals in review guidance before lower-priority observations.

#### Scenario: Summary handles unavailable signal sources
- **WHEN** one or more configured signal sources are unavailable
- **THEN** the summary context SHALL indicate availability limits without treating unavailable sources as passing signals.

#### Scenario: Summary uses normalized bounded signal context
- **WHEN** signal context is included in summary instructions
- **THEN** the context SHALL use normalized reviewer-oriented fields with bounded detail
- **AND** SHALL NOT include raw signal endpoint payloads.
