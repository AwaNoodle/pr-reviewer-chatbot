import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildSummaryCacheKey,
  buildSummaryRateLimitKey,
  canGenerateSummary,
  hasTextualDiffContent,
  markSummaryGenerated,
  readSummaryCache,
  writeSummaryCache,
} from './summary';

const sessionStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(globalThis, 'sessionStorage', {
  value: sessionStorageMock,
  writable: true,
});

describe('summary utilities', () => {
  beforeEach(() => {
    sessionStorageMock.clear();
    vi.clearAllMocks();
  });

  it('builds cache keys that include prompt fingerprinting', () => {
    const first = buildSummaryCacheKey({
      owner: 'org',
      repo: 'repo',
      prNumber: 42,
      headSha: 'abc123',
      summaryPrompt: 'Prompt A',
      summaryCommands: '',
    });
    const second = buildSummaryCacheKey({
      owner: 'org',
      repo: 'repo',
      prNumber: 42,
      headSha: 'abc123',
      summaryPrompt: 'Prompt B',
      summaryCommands: '',
    });

    expect(first).not.toBe(second);
    expect(first).toContain('org/repo#42@abc123');
  });

  it('reads and writes summary cache entries in sessionStorage', () => {
    const cacheKey = buildSummaryCacheKey({
      owner: 'org',
      repo: 'repo',
      prNumber: 5,
      headSha: 'sha-1',
      summaryPrompt: 'prompt',
      summaryCommands: 'cmd',
    });

    writeSummaryCache(cacheKey, {
      content: 'Generated summary',
      generatedAt: 1_000,
    });

    expect(readSummaryCache(cacheKey)).toEqual({
      content: 'Generated summary',
      generatedAt: 1_000,
    });
  });

  it('enforces one summary generation per minute for each PR key', () => {
    const rateLimitKey = buildSummaryRateLimitKey('org', 'repo', 9, 'sha-9');
    expect(canGenerateSummary(rateLimitKey, 10_000)).toBe(true);

    markSummaryGenerated(rateLimitKey, 10_000);

    expect(canGenerateSummary(rateLimitKey, 10_050)).toBe(false);
    expect(canGenerateSummary(rateLimitKey, 70_001)).toBe(true);
  });

  it('detects whether a PR has textual diff content', () => {
    expect(
      hasTextualDiffContent([
        {
          sha: 'a',
          filename: 'img.png',
          status: 'modified',
          additions: 0,
          deletions: 0,
          changes: 0,
          contents_url: '',
        },
      ])
    ).toBe(false);

    expect(
      hasTextualDiffContent([
        {
          sha: 'b',
          filename: 'src/file.ts',
          status: 'modified',
          additions: 1,
          deletions: 1,
          changes: 2,
          contents_url: '',
          patch: '@@ -1 +1 @@',
        },
      ])
    ).toBe(true);
  });
});
