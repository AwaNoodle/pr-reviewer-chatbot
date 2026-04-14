/**
 * Shared normalized signal snapshot builder.
 * Consumed by both summary and chat prompt construction in llm.ts.
 *
 * Source-state semantics are explicitly preserved:
 *  - 'ok'        → signals fetched and have items
 *  - 'ok-empty'  → signals fetched, no items (not failing, not unavailable)
 *  - 'unavailable' → permission / feature limit — must NOT be treated as passing
 *  - 'error'     → fetch failed — must NOT be treated as passing
 */

import type {
  NormalizedCheckRun,
  NormalizedScanningAlert,
  PRSignals,
} from '../types';

// ---------------------------------------------------------------------------
// Caps
// ---------------------------------------------------------------------------

export const SUMMARY_SIGNAL_CAPS = {
  failingChecks: 5,
  pendingChecks: 3,
  failingStatuses: 5,
  pendingStatuses: 3,
  scanningAlerts: 5,
} as const;

export const CHAT_SIGNAL_CAPS = {
  failingChecks: 3,
  pendingChecks: 2,
  failingStatuses: 3,
  pendingStatuses: 2,
  scanningAlerts: 3,
} as const;

// ---------------------------------------------------------------------------
// Deterministic ranking helpers (task 2.5)
// ---------------------------------------------------------------------------

const FAILING_CONCLUSIONS = new Set(['action_required', 'failure', 'timed_out', 'cancelled']);

const CONCLUSION_RANK: Record<string, number> = {
  action_required: 0,
  failure: 1,
  timed_out: 2,
  cancelled: 3,
};

const SEVERITY_RANK: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  error: 4,
  warning: 5,
  note: 6,
  none: 7,
  unknown: 8,
};

export function rankAndCapFailingChecks(
  items: NormalizedCheckRun[],
  limit: number
): NormalizedCheckRun[] {
  return items
    .filter(
      (r) => r.status === 'completed' && FAILING_CONCLUSIONS.has(r.conclusion ?? '')
    )
    .sort(
      (a, b) =>
        (CONCLUSION_RANK[a.conclusion ?? ''] ?? 99) -
        (CONCLUSION_RANK[b.conclusion ?? ''] ?? 99)
    )
    .slice(0, limit);
}

export function rankAndCapPendingChecks(
  items: NormalizedCheckRun[],
  limit: number
): NormalizedCheckRun[] {
  return items.filter((r) => r.status !== 'completed').slice(0, limit);
}

export function rankAndCapScanningAlerts(
  items: NormalizedScanningAlert[],
  limit: number
): NormalizedScanningAlert[] {
  return [...items]
    .sort(
      (a, b) => (SEVERITY_RANK[a.severity] ?? 99) - (SEVERITY_RANK[b.severity] ?? 99)
    )
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// Prompt snapshot builders (task 2.3 / 2.6)
// ---------------------------------------------------------------------------

/**
 * Richer signal snapshot for summary generation context.
 * Includes up to SUMMARY_SIGNAL_CAPS items per category with named details.
 */
export function buildSignalSnapshotForSummary(signals: PRSignals): string {
  const lines: string[] = ['### CI/Check and Scanning Signals'];

  // --- Checks ---
  const { checks } = signals;
  if (checks.sourceState === 'unavailable') {
    lines.push(
      '- Check runs: unavailable (permission or feature configuration limit — not confirmed passing)'
    );
  } else if (checks.sourceState === 'error') {
    lines.push('- Check runs: error (could not fetch — treat as unknown, not passing)');
  } else if (checks.sourceState === 'ok-empty') {
    lines.push('- Check runs: none configured');
  } else {
    const topFailing = rankAndCapFailingChecks(checks.items, SUMMARY_SIGNAL_CAPS.failingChecks);
    const topPending = rankAndCapPendingChecks(checks.items, SUMMARY_SIGNAL_CAPS.pendingChecks);
    const statusParts: string[] = [];
    if (checks.failing > 0) statusParts.push(`${checks.failing} failing`);
    if (checks.pending > 0) statusParts.push(`${checks.pending} pending`);
    if (statusParts.length === 0) statusParts.push('all passing');

    lines.push(`- Check runs: ${statusParts.join(', ')} (${checks.total} total)`);
    if (topFailing.length > 0) {
      lines.push(
        `  Failing: ${topFailing
          .map((r) => `"${r.name}" (${r.conclusion ?? 'unknown'})`)
          .join(', ')}`
      );
    }
    if (topPending.length > 0) {
      lines.push(`  Pending: ${topPending.map((r) => r.name).join(', ')}`);
    }
  }

  // --- Commit statuses ---
  const { statuses } = signals;
  if (statuses.sourceState === 'unavailable') {
    lines.push(
      '- Commit statuses: unavailable (permission limit — not confirmed passing)'
    );
  } else if (statuses.sourceState === 'error') {
    lines.push('- Commit statuses: error (could not fetch — treat as unknown, not passing)');
  } else if (statuses.sourceState === 'ok-empty') {
    lines.push('- Commit statuses: none');
  } else {
    const failingStatuses = statuses.statuses.filter(
      (s) => s.state === 'failure' || s.state === 'error'
    );
    const pendingStatuses = statuses.statuses.filter((s) => s.state === 'pending');

    lines.push(`- Commit statuses: ${statuses.state ?? 'unknown'}`);
    if (failingStatuses.length > 0) {
      lines.push(
        `  Failing: ${failingStatuses
          .slice(0, SUMMARY_SIGNAL_CAPS.failingStatuses)
          .map((s) => `"${s.context}"`)
          .join(', ')}`
      );
    }
    if (pendingStatuses.length > 0) {
      lines.push(
        `  Pending: ${pendingStatuses
          .slice(0, SUMMARY_SIGNAL_CAPS.pendingStatuses)
          .map((s) => `"${s.context}"`)
          .join(', ')}`
      );
    }
  }

  // --- Code scanning ---
  const { scanning } = signals;
  if (scanning.sourceState === 'unavailable') {
    lines.push(
      '- Code scanning: unavailable (permission or feature configuration limit — not confirmed passing)'
    );
  } else if (scanning.sourceState === 'error') {
    lines.push('- Code scanning: error (could not fetch — treat as unknown, not passing)');
  } else if (scanning.sourceState === 'ok-empty') {
    lines.push('- Code scanning: no open alerts');
  } else {
    const topAlerts = rankAndCapScanningAlerts(
      scanning.items,
      SUMMARY_SIGNAL_CAPS.scanningAlerts
    );
    lines.push(
      `- Code scanning: ${scanning.openAlerts} open alert(s) (${scanning.highSeverityCount} critical/high severity)`
    );
    if (topAlerts.length > 0) {
      lines.push(
        `  Top alerts: ${topAlerts
          .map((a) => `"${a.ruleId}" @ ${a.location} (${a.severity})`)
          .join(', ')}`
      );
    }
  }

  return lines.join('\n');
}

/**
 * Compact signal snapshot for chat system context.
 * Prioritizes brevity to preserve diff/review context budget.
 */
export function buildSignalSnapshotForChat(signals: PRSignals): string {
  const parts: string[] = [];

  // --- Checks ---
  const { checks } = signals;
  if (checks.sourceState === 'unavailable') {
    parts.push('Checks: unavailable (not confirmed passing)');
  } else if (checks.sourceState === 'error') {
    parts.push('Checks: error (not confirmed passing)');
  } else if (checks.sourceState === 'ok') {
    if (checks.failing > 0 || checks.pending > 0) {
      const topFailing = rankAndCapFailingChecks(checks.items, CHAT_SIGNAL_CAPS.failingChecks);
      const topPending = rankAndCapPendingChecks(checks.items, CHAT_SIGNAL_CAPS.pendingChecks);
      const statusParts: string[] = [];
      if (checks.failing > 0) statusParts.push(`${checks.failing} failing`);
      if (checks.pending > 0) statusParts.push(`${checks.pending} pending`);
      const names = [
        ...topFailing.map((r) => r.name),
        ...topPending.map((r) => r.name),
      ].slice(0, 5);
      parts.push(`Checks: ${statusParts.join(', ')} [${names.join(', ')}]`);
    } else {
      parts.push('Checks: all passing');
    }
    // ok-empty: omit for compactness
  }

  // --- Statuses ---
  const { statuses } = signals;
  if (statuses.sourceState === 'unavailable') {
    parts.push('Statuses: unavailable (not confirmed passing)');
  } else if (statuses.sourceState === 'error') {
    parts.push('Statuses: error (not confirmed passing)');
  } else if (statuses.sourceState === 'ok' && statuses.state && statuses.state !== 'success') {
    const failingStatuses = statuses.statuses
      .filter((s) => s.state === 'failure' || s.state === 'error')
      .slice(0, CHAT_SIGNAL_CAPS.failingStatuses)
      .map((s) => s.context);
    const detail = failingStatuses.length > 0 ? ` [${failingStatuses.join(', ')}]` : '';
    parts.push(`Statuses: ${statuses.state}${detail}`);
  }

  // --- Scanning ---
  const { scanning } = signals;
  if (scanning.sourceState === 'unavailable') {
    parts.push('Scanning: unavailable (not confirmed passing)');
  } else if (scanning.sourceState === 'error') {
    parts.push('Scanning: error (not confirmed passing)');
  } else if (scanning.sourceState === 'ok' && scanning.openAlerts > 0) {
    const topAlerts = rankAndCapScanningAlerts(
      scanning.items,
      CHAT_SIGNAL_CAPS.scanningAlerts
    );
    parts.push(
      `Scanning: ${scanning.openAlerts} open (${scanning.highSeverityCount} high+) [${topAlerts.map((a) => a.ruleId).join(', ')}]`
    );
  }

  if (parts.length === 0) return '';
  return `CI/Scanning: ${parts.join(' | ')}`;
}
