import type {
  LLMMessage,
  LLMChatRequest,
  LLMChatResponse,
  LLMStreamChunk,
  PRContext,
  PRCommit,
  AppConfig,
} from '../types';

export class LLMService {
  private static readonly MAX_SYSTEM_PROMPT_CHARS = 24_000;

  private config: AppConfig;

  constructor(config: AppConfig) {
    this.config = config;
  }

  private getBaseUrl(): string {
    // Use the Vite dev proxy path to avoid CORS issues when the endpoint is
    // a different origin (e.g. a local LM Studio / LiteLLM server).
    // The proxy is configured in vite.config.ts and rewrites /api/llm → <endpoint>.
    // In production, the VITE_LLM_USE_PROXY env var can be set to 'false' to
    // use the direct endpoint URL (when a proper reverse proxy is in place).
    const useProxy = import.meta.env.VITE_USE_PROXY !== 'false';
    if (useProxy) {
      return '/api/llm';
    }
    return this.config.llmEndpoint.replace(/\/$/, '');
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.config.llmApiKey) {
      headers['Authorization'] = `Bearer ${this.config.llmApiKey}`;
    }

    return headers;
  }

  async chat(messages: LLMMessage[], options?: { signal?: AbortSignal }): Promise<string> {
    const request: LLMChatRequest = {
      model: this.config.llmModel,
      messages,
      stream: false,
    };

    const response = await fetch(`${this.getBaseUrl()}/chat/completions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(request),
      signal: options?.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LLM API error ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as LLMChatResponse;
    return data.choices[0]?.message?.content ?? '';
  }

  async *chatStream(
    messages: LLMMessage[],
    options?: { signal?: AbortSignal }
  ): AsyncGenerator<string, void, unknown> {
    const request: LLMChatRequest = {
      model: this.config.llmModel,
      messages,
      stream: true,
    };

    const response = await fetch(`${this.getBaseUrl()}/chat/completions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(request),
      signal: options?.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LLM API error ${response.status}: ${errorText}`);
    }

    if (!response.body) {
      throw new Error('No response body for streaming');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;

          if (trimmed.startsWith('data: ')) {
            const jsonStr = trimmed.slice(6);
            try {
              const chunk = JSON.parse(jsonStr) as LLMStreamChunk;
              const content = chunk.choices[0]?.delta?.content;
              if (content) {
                yield content;
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  buildSystemPrompt(context: PRContext): string {
    const { pr, files, comments, reviewComments, reviews } = context;

    const filesSummary = files
      .map(
        (f) =>
          `- ${f.filename} (${f.status}: +${f.additions}/-${f.deletions})`
      )
      .join('\n');

    const commentsContent = comments
      .map((c) => `**${c.user.login}**: ${c.body}`)
      .join('\n\n');

    const reviewsContent = reviews
      .map((r) => `**${r.user.login}** (${r.state}): ${r.body ?? '(no comment)'}`)
      .join('\n\n');

    const reviewCommentsContent = reviewComments
      .map(
        (rc) =>
          `**${rc.user.login}** on \`${rc.path}\`:\n> ${rc.diff_hunk}\n\n${rc.body}`
      )
      .join('\n\n');

    const commentsSection = comments.length > 0 ? `### PR Comments\n${commentsContent}` : '';
    const reviewsSection = reviews.length > 0 ? `### Reviews\n${reviewsContent}` : '';
    const inlineCommentsSection =
      reviewComments.length > 0 ? `### Inline Review Comments\n${reviewCommentsContent}` : '';

    const promptPreamble = `You are an expert code reviewer assistant helping to analyze a GitHub Pull Request.

## Pull Request: #${pr.number} - ${pr.title}

**Author**: ${pr.user.login}
**State**: ${pr.state}${pr.merged ? ' (merged)' : ''}
**Branch**: \`${pr.head.ref}\` → \`${pr.base.ref}\`
**Stats**: +${pr.additions} additions, -${pr.deletions} deletions, ${pr.changed_files} files changed

### Description
${pr.body ?? '(no description)'}

### Changed Files
${filesSummary}

### Diffs`;

    const promptPostamble = `${commentsSection ? `\n\n${commentsSection}` : ''}

${reviewsSection ? `\n\n${reviewsSection}` : ''}

${inlineCommentsSection ? `\n\n${inlineCommentsSection}` : ''}

---

You have full context of this PR metadata and file summaries. Included diffs may be truncated by context budget. Answer questions about the code changes, provide code review feedback, explain what the changes do, identify potential issues, suggest improvements, and help the user understand the PR. Be specific and reference actual code from the included diff when relevant.`;

    const maxDiffBudget = Math.max(
      0,
      LLMService.MAX_SYSTEM_PROMPT_CHARS - promptPreamble.length - promptPostamble.length - 2
    );

    const diffSections = files
      .filter((f) => Boolean(f.patch))
      .map((f) => ({
        filename: f.filename,
        content: `### ${f.filename}\n\`\`\`diff\n${f.patch}\n\`\`\``,
      }));

    const includedDiffs: string[] = [];
    const omittedDiffFilenames: string[] = [];
    let usedDiffChars = 0;

    for (const diff of diffSections) {
      const separator = includedDiffs.length > 0 ? '\n\n' : '\n';
      const nextSize = usedDiffChars + separator.length + diff.content.length;

      if (nextSize <= maxDiffBudget) {
        includedDiffs.push(diff.content);
        usedDiffChars = nextSize;
      } else {
        omittedDiffFilenames.push(diff.filename);
      }
    }

    const omissionSummary =
      omittedDiffFilenames.length > 0
        ? `\n\n[Context budget] Omitted ${omittedDiffFilenames.length} diff(s): ${omittedDiffFilenames.join(', ')}`
        : '';

    const diffContent =
      includedDiffs.length > 0
        ? `\n${includedDiffs.join('\n\n')}${omissionSummary}`
        : `${omissionSummary || '\n(No textual diffs available)'}`;

    return `${promptPreamble}${diffContent}${promptPostamble}

## Citation Grounding Instructions

When making non-trivial claims about code behavior, risk, correctness, or security implications, you SHOULD cite the specific file(s) and line(s) from the diff. Use this format:

- **[file:path]** - for file-level citations
- **[file:path#L]** or **[file:path#L-L]** - for line range citations

Example citations:
- "The JWT secret validation is missing" → cite with "[src/auth.ts#L12]" or similar
- "Memory leak in error path" → cite the relevant code lines

Citations should use exact file paths from the changed files list. Keep claims precise and verifiable.`;
  }

  buildSummaryPrompt(
    context: PRContext,
    summaryPrompt: string,
    summaryCommands: string,
    signalsData?: unknown
  ): string {
    void signalsData;
    const commitMessages = (context.commits ?? [])
      .map((commit: PRCommit) => `- ${commit.commit.message.split('\n')[0]}`)
      .join('\n');

    const diffFiles = context.files
      .filter((file) => Boolean(file.patch))
      .map((file) => `- ${file.filename}`)
      .join('\n');

    const commandsSection = summaryCommands.trim()
      ? `\nAdditional commands:\n${summaryCommands.trim()}`
      : '';

    return `${summaryPrompt.trim()}${commandsSection}

PR metadata:
- Number: #${context.pr.number}
- Title: ${context.pr.title}
- Author: ${context.pr.user.login}
- Branch: ${context.pr.head.ref} -> ${context.pr.base.ref}
- Diff stats: +${context.pr.additions}/-${context.pr.deletions}, ${context.pr.changed_files} files

PR description:
${context.pr.body ?? '(no description)'}

Commit messages:
${commitMessages || '(no commit messages available)'}

Changed files with textual diffs:
${diffFiles || '(no textual diffs available)'}

Response contract (required):
- Start with an orientation section of exactly 2-4 lines.
- Add a "Focus Areas" section only when meaningful risk, complexity, or churn signals exist.
- Focus Areas count must stay within 0-4 items.
- If Focus Areas are present, each item must include:
  - where to review
  - why it matters
  - what to verify
- Keep language concise and reviewer-oriented.

Citation grounding (required for non-trivial claims):
- When a Focus Area makes a non-trivial claim about risk, behavior, or correctness, cite the specific file(s) and line(s) from the diff.
- Use format: [file:path#L] for single lines or [file:path#L-L] for ranges.
- Example: "Missing null check" → "[src/auth.ts#L45]"
- If exact line citation is not possible, cite the file-level: "[src/auth.ts]"
- Every non-trivial claim SHOULD have at least one citation.`;
  }
}

export function createLLMService(config: AppConfig): LLMService {
  return new LLMService(config);
}
