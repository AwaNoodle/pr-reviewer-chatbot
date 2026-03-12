import { describe, it, expect } from 'vitest';
import { buildDiffLineKeys } from './prViewerUtils';

describe('buildDiffLineKeys', () => {
  it('creates stable unique keys for duplicate lines', () => {
    const keys = buildDiffLineKeys(['+const x = 1;', '+const x = 1;', '-const y = 2;']);

    expect(keys).toEqual(['+const x = 1;::1', '+const x = 1;::2', '-const y = 2;::1']);
    expect(new Set(keys).size).toBe(3);
  });

  it('produces deterministic keys for the same patch content', () => {
    const lines = ['@@ -1,2 +1,2 @@', '-old', '+new', '+new'];

    expect(buildDiffLineKeys(lines)).toEqual(buildDiffLineKeys(lines));
  });
});
