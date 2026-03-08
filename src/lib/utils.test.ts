import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cn, formatDate, generateId, truncate } from './utils';

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('deduplicates conflicting Tailwind classes (last wins)', () => {
    // tailwind-merge resolves conflicts: p-4 overrides p-2
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });

  it('handles conditional classes', () => {
    expect(cn('base', false && 'hidden', 'visible')).toBe('base visible');
  });

  it('handles undefined and null gracefully', () => {
    expect(cn('a', undefined, null, 'b')).toBe('a b');
  });
});

describe('formatDate', () => {
  beforeEach(() => {
    // Fix "now" to 2024-01-15T12:00:00Z for deterministic tests
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns minutes ago for dates within the same hour', () => {
    const thirtyMinsAgo = new Date('2024-01-15T11:30:00Z').toISOString();
    expect(formatDate(thirtyMinsAgo)).toBe('30m ago');
  });

  it('returns hours ago for dates within the same day', () => {
    const threeHoursAgo = new Date('2024-01-15T09:00:00Z').toISOString();
    expect(formatDate(threeHoursAgo)).toBe('3h ago');
  });

  it('returns days ago for dates within the same week', () => {
    const threeDaysAgo = new Date('2024-01-12T12:00:00Z').toISOString();
    expect(formatDate(threeDaysAgo)).toBe('3d ago');
  });

  it('returns weeks ago for dates within the same month', () => {
    const twoWeeksAgo = new Date('2024-01-01T12:00:00Z').toISOString();
    expect(formatDate(twoWeeksAgo)).toBe('2w ago');
  });

  it('returns a formatted date for older dates', () => {
    const oldDate = new Date('2023-06-15T12:00:00Z').toISOString();
    // Should return something like "Jun 15, 2023"
    expect(formatDate(oldDate)).toMatch(/Jun\s+15,\s+2023/);
  });
});

describe('generateId', () => {
  it('returns a non-empty string', () => {
    expect(typeof generateId()).toBe('string');
    expect(generateId().length).toBeGreaterThan(0);
  });

  it('returns a valid UUID v4 format', () => {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(generateId()).toMatch(uuidRegex);
  });

  it('generates unique IDs on each call', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });
});

describe('truncate', () => {
  it('returns the original string when shorter than maxLength', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });

  it('returns the original string when equal to maxLength', () => {
    expect(truncate('hello', 5)).toBe('hello');
  });

  it('truncates and appends ellipsis when longer than maxLength', () => {
    expect(truncate('hello world', 8)).toBe('hello...');
  });

  it('handles empty string', () => {
    expect(truncate('', 5)).toBe('');
  });
});
