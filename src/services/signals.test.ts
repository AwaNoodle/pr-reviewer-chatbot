import { describe, expect, it } from 'vitest';
import { buildSignalSnapshotForChat, buildSignalSnapshotForSummary } from './signals';
import type { PRSignals } from '../types';

function makeSignals(): PRSignals {
  return {
    checks: {
      sourceState: 'ok',
      total: 8,
      failing: 4,
      pending: 3,
      items: [
        { id: 1, name: 'zeta', status: 'completed', conclusion: 'failure' },
        { id: 2, name: 'alpha', status: 'completed', conclusion: 'action_required' },
        { id: 3, name: 'beta', status: 'completed', conclusion: 'timed_out' },
        { id: 4, name: 'gamma', status: 'completed', conclusion: 'cancelled' },
        { id: 5, name: 'pending-a', status: 'in_progress', conclusion: null },
        { id: 6, name: 'pending-b', status: 'queued', conclusion: null },
        { id: 7, name: 'pending-c', status: 'waiting', conclusion: null },
        { id: 8, name: 'pass', status: 'completed', conclusion: 'success' },
      ],
    },
    statuses: {
      sourceState: 'ok',
      state: 'failure',
      statuses: [
        { context: 'lint', state: 'failure', description: null },
        { context: 'tests', state: 'pending', description: null },
        { context: 'build', state: 'error', description: null },
      ],
    },
    scanning: {
      sourceState: 'ok',
      openAlerts: 3,
      highSeverityCount: 2,
      severityBuckets: {
        critical: 1,
        high: 1,
        medium: 1,
        low: 0,
        error: 0,
        warning: 0,
        note: 0,
        none: 0,
        unknown: 0,
      },
      items: [
        { number: 11, ruleId: 'rule-low', severity: 'low', state: 'open', location: 'src/a.ts:1' },
        { number: 12, ruleId: 'rule-critical', severity: 'critical', state: 'open', location: 'src/b.ts:2' },
        { number: 13, ruleId: 'rule-high', severity: 'high', state: 'open', location: 'src/c.ts:3' },
      ],
    },
    fetchedAt: Date.now(),
    headSha: 'abcdef12',
  };
}

describe('signal prompt snapshots', () => {
  it('builds bounded summary signal details with deterministic ranking', () => {
    const snapshot = buildSignalSnapshotForSummary(makeSignals());

    expect(snapshot).toContain('### CI/Check and Scanning Signals');
    expect(snapshot).toContain('4 failing, 3 pending');
    expect(snapshot).toContain('"alpha" (action_required)');
    expect(snapshot).toContain('"zeta" (failure)');
    expect(snapshot).toContain('Top alerts: "rule-critical"');
    expect(snapshot).toContain('"rule-high"');
    expect(snapshot).not.toContain('raw endpoint payload');
  });

  it('builds compact chat signal snapshot with truncation', () => {
    const snapshot = buildSignalSnapshotForChat(makeSignals());

    expect(snapshot).toContain('CI/Scanning:');
    expect(snapshot).toContain('Checks: 4 failing, 3 pending');
    expect(snapshot).toContain('Statuses: failure [lint, build]');
    expect(snapshot).toContain('Scanning: 3 open (2 high+) [rule-critical, rule-high, rule-low]');
    expect(snapshot).not.toContain('pending-c');
  });

  it('never maps unavailable or error sources to passing semantics', () => {
    const base = makeSignals();
    const unavailableSnapshot = buildSignalSnapshotForSummary({
      ...base,
      checks: { ...base.checks, sourceState: 'unavailable', total: 0, failing: 0, pending: 0, items: [] },
      statuses: { ...base.statuses, sourceState: 'error', state: null, statuses: [] },
      scanning: { ...base.scanning, sourceState: 'unavailable', openAlerts: 0, highSeverityCount: 0, items: [] },
    });

    expect(unavailableSnapshot).toContain('not confirmed passing');
    expect(unavailableSnapshot).toContain('treat as unknown, not passing');
    expect(unavailableSnapshot).not.toContain('all passing');
    expect(unavailableSnapshot).not.toContain('no open alerts');
  });
});
