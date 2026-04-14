import type { DiffCitation, CitationParseResult, AssistantClaim, ResolvedCitation, PRFile } from '../types';
import { generateId } from '../lib/utils';

const CITATION_PATTERN = /\[([^\]]+):([^\]#]+)(?:#([A-Za-z]?\d+)(?:-([A-Za-z]?\d+))?)?\]/g;

const UNCITED_INDICATORS = [
  '[UNCITED]',
  '[uncited]',
  '[no citation]',
  '[low confidence]',
  '[unverified]',
];

export function parseCitationsFromText(text: string): CitationParseResult {
  const claims: AssistantClaim[] = [];
  const uncitedText: string[] = [];
  const parseErrors: string[] = [];

  const segments = splitIntoSegments(text);

  for (const segment of segments) {
    const trimmedSegment = segment.trim();

    if (isUncitedIndicator(trimmedSegment)) {
      continue;
    }

    const citations: DiffCitation[] = [];
    let cleanText = trimmedSegment;
    let match: RegExpExecArray | null;

    CITATION_PATTERN.lastIndex = 0;
    while ((match = CITATION_PATTERN.exec(trimmedSegment)) !== null) {
      const [, type, filePath, lineStart, lineEnd] = match;
      if (type !== 'file') {
        parseErrors.push(`Unsupported citation type: ${type}`);
        continue;
      }

      citations.push({
        file: filePath.trim(),
        lineStart: lineStart ? parseInt(lineStart.replace(/^[A-Za-z]+/, ''), 10) : undefined,
        lineEnd: lineEnd ? parseInt(lineEnd.replace(/^[A-Za-z]+/, ''), 10) : undefined,
      });

      cleanText = cleanText.replace(match[0], '').trim();
    }

    if (citations.length > 0) {
      claims.push({
        id: generateId(),
        text: cleanText || trimmedSegment,
        citations,
        confidence: 'high',
      });
    } else if (trimmedSegment.length > 0) {
      const wordCount = trimmedSegment.split(/\s+/).length;
      const isSubstantial = wordCount >= 3;
      claims.push({
        id: generateId(),
        text: trimmedSegment,
        citations: [],
        confidence: isSubstantial ? 'uncited' : 'low',
      });
      if (isSubstantial) {
        uncitedText.push(trimmedSegment);
      }
    }
  }

  return { claims, uncitedText, parseErrors };
}

function splitIntoSegments(text: string): string[] {
  return text
    .split(/\n(?=\s*[-*]\s+)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function isUncitedIndicator(text: string): boolean {
  return UNCITED_INDICATORS.some((indicator) => text.startsWith(indicator));
}

export function resolveCitations(
  claims: AssistantClaim[],
  files: PRFile[]
): ResolvedCitation[] {
  const results: ResolvedCitation[] = [];

  for (const claim of claims) {
    for (const citation of claim.citations) {
      const resolved = resolveCitation(citation, files);
      results.push(resolved);
    }
  }

  return results;
}

function resolveCitation(citation: DiffCitation, files: PRFile[]): ResolvedCitation {
  const normalizedFile = citation.file.toLowerCase().replace(/^\//, '');

  const fileIndex = files.findIndex(
    (f) => f.filename.toLowerCase().replace(/^\//, '') === normalizedFile
  );

  if (fileIndex === -1) {
    return {
      citation,
      resolved: false,
      fileIndex: null,
      lineAnchor: null,
      reason: `File not found: ${citation.file}`,
    };
  }

  if (citation.lineStart === undefined) {
    return {
      citation,
      resolved: true,
      fileIndex,
      lineAnchor: null,
    };
  }

  const file = files[fileIndex];
  const lineAnchor = citation.lineStart;

  if (!file.patch) {
    return {
      citation,
      resolved: true,
      fileIndex,
      lineAnchor,
      reason: 'No patch available for exact line navigation',
    };
  }

  const lines = file.patch.split('\n');
  let foundLine = false;

  for (let i = 0; i < lines.length; i++) {
    const lineNumMatch = lines[i].match(/^@@ -(\d+)/);
    if (lineNumMatch) {
      const hunkStart = parseInt(lineNumMatch[1], 10);
      const contextLineIndex = i + 1;
      const absoluteLine = hunkStart - 1 + contextLineIndex;

      if (absoluteLine <= citation.lineStart && citation.lineStart < absoluteLine + 10) {
        foundLine = true;
        break;
      }
    }
  }

  if (!foundLine && citation.lineEnd === undefined) {
    return {
      citation,
      resolved: true,
      fileIndex,
      lineAnchor,
      reason: 'Line reference may be stale or outside visible hunk',
    };
  }

  return {
    citation,
    resolved: true,
    fileIndex,
    lineAnchor,
  };
}

export function normalizeCitationPayload(raw: string): CitationParseResult {
  try {
    return parseCitationsFromText(raw);
  } catch (error) {
    return {
      claims: [
        {
          id: generateId(),
          text: raw,
          citations: [],
          confidence: 'uncited',
        },
      ],
      uncitedText: [raw],
      parseErrors: [error instanceof Error ? error.message : 'Unknown parse error'],
    };
  }
}

export function extractMarkdownWithoutCitations(text: string): string {
  return text.replace(CITATION_PATTERN, '').trim();
}

export interface CitationNavigationResult {
  fileIndex: number | null;
  line: number | null;
  resolved: boolean;
  reason?: string;
  displayPath: string;
}

export function resolveCitationForNavigation(
  citation: DiffCitation,
  files: PRFile[]
): CitationNavigationResult {
  const normalizedFile = citation.file.toLowerCase().replace(/^\//, '');

  const fileIndex = files.findIndex(
    (f) => f.filename.toLowerCase().replace(/^\//, '') === normalizedFile
  );

  if (fileIndex === -1) {
    return {
      fileIndex: null,
      line: null,
      resolved: false,
      reason: `File "${citation.file}" not found in this PR`,
      displayPath: citation.file,
    };
  }

  if (citation.lineStart === undefined) {
    return {
      fileIndex,
      line: null,
      resolved: true,
      displayPath: files[fileIndex].filename,
    };
  }

  return {
    fileIndex,
    line: citation.lineStart,
    resolved: true,
    displayPath: files[fileIndex].filename,
  };
}
