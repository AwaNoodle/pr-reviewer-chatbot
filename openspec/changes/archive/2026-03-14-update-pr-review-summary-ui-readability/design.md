## Context

The current PR Summary tab already supports loading, success, empty, and error states, but the visual structure is dense and difficult to scan during review. Summary content often includes markdown lists and emphasis, yet the presentation does not consistently prioritize hierarchy, whitespace, or readability across viewport sizes. This change is constrained to front-end presentation in the existing summary flow and must preserve current generation behavior, caching, and LLM integration.

## Goals / Non-Goals

**Goals:**
- Improve summary readability by introducing clearer hierarchy, spacing, and section separation in the Summary tab.
- Ensure generated markdown renders with legible typography for paragraphs, lists, emphasis, and code snippets.
- Maintain clear, distinct visual treatment for loading, empty, success, and error states.
- Preserve usability on both desktop and mobile widths.

**Non-Goals:**
- No changes to summary prompt logic, LLM request orchestration, or caching/rate-limiting behavior.
- No changes to chat behavior, PR data fetching, or API contracts.
- No new dependencies or full visual redesign of unrelated tabs.

## Decisions

- Keep all changes inside `PRViewer` summary rendering and related summary styles, with no changes to summary generation logic or data contracts.
- Render successful summary output as a panelized layout aligned with existing Comments/Reviews visual patterns (rounded bordered cards with compact metadata-style headers).
- Parse generated summary into one `Orientation` panel for the leading orientation text block and one panel per `Focus Area` item when present.
- Use title color accents to reinforce hierarchy and scanability: `Orientation` title uses blue accent styling and each `Focus Area` title uses yellow accent styling.
- Leave loading, empty, and error state semantics unchanged; only align presentation with readability goals where needed.

## Risks / Trade-offs

- [Risk] Increased visual complexity from additional style rules may make future tweaks harder → Mitigation: keep styling localized to summary-specific classes and reuse existing design tokens.
- [Risk] Snapshot or UI behavior tests may become brittle after markup/class updates → Mitigation: update tests to assert stable semantics and key state markers instead of fragile style details.
- [Risk] Better readability may require slightly more vertical space in the summary pane → Mitigation: preserve compact defaults and only expand spacing where it improves comprehension.
