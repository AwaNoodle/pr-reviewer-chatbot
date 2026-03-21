## Context

The current PR review experience generates helpful natural-language output, but it does not consistently anchor claims to exact diff locations. This makes reviewer verification slower and increases the chance of over-trusting uncited model output.

This change crosses prompt construction, response parsing, Redux state flow, and multiple UI surfaces (summary + chat), so a cohesive design is required before implementation.

## Goals / Non-Goals

**Goals:**
- Introduce a structured citation contract for assistant output that maps claims to concrete diff references.
- Make citations directly navigable in the UI so reviewers can jump from claim to evidence.
- Preserve current behavior when citations are missing by showing explicit uncited/low-confidence treatment instead of failing rendering.

**Non-Goals:**
- This change does not auto-post review comments to GitHub.
- This change does not introduce semantic code indexing or embeddings.
- This change does not guarantee perfect line-level grounding for every model/provider.

## Decisions

### Decision: Add a structured citation payload with graceful markdown fallback
- **Choice:** Extend assistant output contract to allow a machine-readable citation section that can be parsed into typed references (`file`, optional line range, optional hunk/snippet token), while still accepting plain markdown fallback content.
- **Rationale:** Structured references are required for reliable click-to-navigate UX, but strict rejection of non-structured output would degrade resilience across model providers.
- **Alternatives considered:**
  - Parse free-form markdown only: rejected because reliability is too low for navigation.
  - Enforce strict JSON-only response: rejected because it harms readability and increases fragility.

### Decision: Resolve navigation by file + nearest available hunk first, then optional line anchors
- **Choice:** Citation click resolves to file view and expands the most relevant available patch hunk; line anchors are used when present and resolvable.
- **Rationale:** GitHub PR patches do not always provide stable absolute line mappings in all cases, so hunk-first navigation is robust and still useful.
- **Alternatives considered:**
  - Require exact line mapping always: rejected because unresolved references become common and noisy.

### Decision: Distinguish cited vs uncited claims in UI
- **Choice:** Render citation chips for grounded content and a clear uncited marker for claims without references.
- **Rationale:** Users need fast trust signals and should not infer equal confidence across all assistant statements.
- **Alternatives considered:**
  - Hide uncited state: rejected because it obscures evidence quality.

### Decision: Reuse existing summary and chat pipelines with incremental schema additions
- **Choice:** Extend `buildSummaryPrompt` and chat prompt guidance in `LLMService`, parse citations in existing assistant rendering path, and keep Redux slice shape additive.
- **Rationale:** Minimizes migration risk and keeps rollout incremental.
- **Alternatives considered:**
  - Build a separate citation microservice: rejected as unnecessary scope and operational complexity.

## Risks / Trade-offs

- [Model output inconsistency across providers] -> Mitigation: tolerate fallback markdown and log/track parse failures.
- [Citation references stale after PR reload or force-push] -> Mitigation: key references to active PR head SHA context and invalidate stale mappings.
- [UI complexity in diff navigation states] -> Mitigation: keep navigation states minimal (resolved, unresolved) and provide clear user messaging.

## Migration Plan

1. Introduce citation types and parser behind additive fields so legacy messages remain renderable.
2. Add citation-aware rendering in summary and chat with unresolved-reference fallback messaging.
3. Wire click-to-navigate interactions into existing Files tab expansion/highlight behavior.
4. Roll out prompt contract updates and validate with current model backends.
5. Add regression tests for parsing, rendering, and navigation.

Rollback strategy: keep parser and UI citation rendering feature-guarded by presence of structured references; removing/ignoring citation fields reverts to current markdown-only behavior.

## Open Questions

- Should unresolved citations be auto-hidden or shown as disabled chips with reason text?
- Should citation coverage percentage be displayed as a summary quality metric?
- Do we want optional provider-specific prompt variants for better citation adherence?
