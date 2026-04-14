import { describe, it, expect } from 'vitest';
import {
  parseCitationsFromText,
  resolveCitations,
  normalizeCitationPayload,
  extractMarkdownWithoutCitations,
  resolveCitationForNavigation,
} from './citations';
import type { PRFile } from '../types';

const mockFile: PRFile = {
  sha: 'aaa',
  filename: 'src/auth.ts',
  status: 'added',
  additions: 50,
  deletions: 0,
  changes: 50,
  contents_url: '',
  patch: `@@ -0,0 +1,10 @@
+import { Request } from 'express';
+import { JWT } from 'jsonwebtoken';
+
+export async function authenticate(req: Request) {
+  const token = req.headers.authorization?.split(' ')[1];
+  if (!token) {
+    return null;
+  }
+  try {
+    const decoded = JWT.verify(token, process.env.JWT_SECRET);
+    return decoded;
+  } catch (err) {
+    return null;
+  }
+}`,
};

const mockFiles: PRFile[] = [
  mockFile,
  {
    sha: 'bbb',
    filename: 'src/middleware.ts',
    status: 'modified',
    additions: 10,
    deletions: 2,
    changes: 12,
    contents_url: '',
  },
];

const cite = (target: string) => `[${['file', target].join(':')}]`;

describe('parseCitationsFromText', () => {
  it('parses single file citation', () => {
    const result = parseCitationsFromText(`Missing authentication check ${cite('src/auth.ts')}`);
    expect(result.claims).toHaveLength(1);
    expect(result.claims[0].citations).toHaveLength(1);
    expect(result.claims[0].citations[0].file).toBe('src/auth.ts');
    expect(result.claims[0].confidence).toBe('high');
  });

  it('parses citation with line number', () => {
    const result = parseCitationsFromText(`Null check missing ${cite('src/auth.ts#L45')}`);
    expect(result.claims).toHaveLength(1);
    expect(result.claims[0].citations[0].file).toBe('src/auth.ts');
    expect(result.claims[0].citations[0].lineStart).toBe(45);
  });

  it('parses citation with line range', () => {
    const result = parseCitationsFromText(`Code block ${cite('src/auth.ts#L10-L20')}`);
    expect(result.claims).toHaveLength(1);
    expect(result.claims[0].citations[0].file).toBe('src/auth.ts');
    expect(result.claims[0].citations[0].lineStart).toBe(10);
    expect(result.claims[0].citations[0].lineEnd).toBe(20);
  });

  it('handles text without citations as uncited', () => {
    const result = parseCitationsFromText('This is a general observation about the code.');
    expect(result.claims).toHaveLength(1);
    expect(result.claims[0].citations).toHaveLength(0);
    expect(result.claims[0].confidence).toBe('uncited');
    expect(result.uncitedText).toContain('This is a general observation about the code.');
  });

  it('marks short text as low confidence', () => {
    const result = parseCitationsFromText('OK');
    expect(result.claims).toHaveLength(1);
    expect(result.claims[0].confidence).toBe('low');
  });

  it('handles multiple citations in one text', () => {
    const result = parseCitationsFromText(
      `Check both ${cite('src/auth.ts#L5')} and ${cite('src/middleware.ts#L12')}`
    );
    expect(result.claims).toHaveLength(1);
    expect(result.claims[0].citations).toHaveLength(2);
  });

  it('handles list items with citations', () => {
    const result = parseCitationsFromText(
      `- First item ${cite('src/auth.ts')}\n- Second item ${cite('src/middleware.ts')}`
    );
    expect(result.claims.length).toBeGreaterThanOrEqual(1);
  });
});

describe('resolveCitations', () => {
  it('resolves existing file citation', () => {
    const claims = [
      {
        id: '1',
        text: 'Auth file',
        citations: [{ file: 'src/auth.ts' }],
        confidence: 'high' as const,
      },
    ];
    const resolved = resolveCitations(claims, mockFiles);
    expect(resolved).toHaveLength(1);
    expect(resolved[0].resolved).toBe(true);
    expect(resolved[0].fileIndex).toBe(0);
  });

  it('marks missing file as unresolved', () => {
    const claims = [
      {
        id: '1',
        text: 'Missing file',
        citations: [{ file: 'src/nonexistent.ts' }],
        confidence: 'high' as const,
      },
    ];
    const resolved = resolveCitations(claims, mockFiles);
    expect(resolved).toHaveLength(1);
    expect(resolved[0].resolved).toBe(false);
    expect(resolved[0].reason).toContain('not found');
  });

  it('handles case-insensitive file matching', () => {
    const claims = [
      {
        id: '1',
        text: 'Auth file',
        citations: [{ file: 'SRC/AUTH.TS' }],
        confidence: 'high' as const,
      },
    ];
    const resolved = resolveCitations(claims, mockFiles);
    expect(resolved[0].resolved).toBe(true);
  });

  it('handles file path with leading slash', () => {
    const claims = [
      {
        id: '1',
        text: 'Auth file',
        citations: [{ file: '/src/auth.ts' }],
        confidence: 'high' as const,
      },
    ];
    const resolved = resolveCitations(claims, mockFiles);
    expect(resolved[0].resolved).toBe(true);
  });
});

describe('resolveCitationForNavigation', () => {
  it('returns file index for valid citation', () => {
    const result = resolveCitationForNavigation({ file: 'src/auth.ts' }, mockFiles);
    expect(result.resolved).toBe(true);
    expect(result.fileIndex).toBe(0);
    expect(result.displayPath).toBe('src/auth.ts');
  });

  it('returns line number when provided', () => {
    const result = resolveCitationForNavigation({ file: 'src/auth.ts', lineStart: 10 }, mockFiles);
    expect(result.resolved).toBe(true);
    expect(result.line).toBe(10);
  });

  it('returns unresolved for missing file', () => {
    const result = resolveCitationForNavigation({ file: 'src/missing.ts' }, mockFiles);
    expect(result.resolved).toBe(false);
    expect(result.reason).toBeDefined();
  });
});

describe('normalizeCitationPayload', () => {
  it('returns parsed result on success', () => {
    const result = normalizeCitationPayload(`Test ${cite('src/auth.ts')}`);
    expect(result.claims).toHaveLength(1);
    expect(result.parseErrors).toHaveLength(0);
  });

  it('falls back to uncited claim on error', () => {
    const result = normalizeCitationPayload('Just some text');
    expect(result.claims).toHaveLength(1);
    expect(result.claims[0].confidence).toBe('uncited');
  });
});

describe('extractMarkdownWithoutCitations', () => {
  it('removes citation markers from text', () => {
    const result = extractMarkdownWithoutCitations(
      `Missing check ${cite('src/auth.ts#L45')} in the code`
    );
    expect(result).toBe('Missing check  in the code');
    expect(result).not.toContain('[file:');
  });

  it('handles text without citations', () => {
    const result = extractMarkdownWithoutCitations('Plain text without citations');
    expect(result).toBe('Plain text without citations');
  });
});
