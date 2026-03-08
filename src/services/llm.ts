import type {
  LLMMessage,
  LLMChatRequest,
  LLMChatResponse,
  LLMStreamChunk,
  PRContext,
  AppConfig,
} from '../types';

export class LLMService {
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

  async chat(messages: LLMMessage[]): Promise<string> {
    const request: LLMChatRequest = {
      model: this.config.llmModel,
      messages,
      stream: false,
    };

    const response = await fetch(`${this.getBaseUrl()}/chat/completions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LLM API error ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as LLMChatResponse;
    return data.choices[0]?.message?.content ?? '';
  }

  async *chatStream(messages: LLMMessage[]): AsyncGenerator<string, void, unknown> {
    const request: LLMChatRequest = {
      model: this.config.llmModel,
      messages,
      stream: true,
    };

    const response = await fetch(`${this.getBaseUrl()}/chat/completions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(request),
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

    const diffContent = files
      .filter((f) => f.patch)
      .map((f) => `### ${f.filename}\n\`\`\`diff\n${f.patch}\n\`\`\``)
      .join('\n\n');

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

    return `You are an expert code reviewer assistant helping to analyze a GitHub Pull Request.

## Pull Request: #${pr.number} - ${pr.title}

**Author**: ${pr.user.login}
**State**: ${pr.state}${pr.merged ? ' (merged)' : ''}
**Branch**: \`${pr.head.ref}\` → \`${pr.base.ref}\`
**Stats**: +${pr.additions} additions, -${pr.deletions} deletions, ${pr.changed_files} files changed

### Description
${pr.body ?? '(no description)'}

### Changed Files
${filesSummary}

### Diffs
${diffContent}

${comments.length > 0 ? `### PR Comments\n${commentsContent}` : ''}

${reviews.length > 0 ? `### Reviews\n${reviewsContent}` : ''}

${reviewComments.length > 0 ? `### Inline Review Comments\n${reviewCommentsContent}` : ''}

---

You have full context of this PR. Answer questions about the code changes, provide code review feedback, explain what the changes do, identify potential issues, suggest improvements, and help the user understand the PR. Be specific and reference actual code from the diff when relevant.`;
  }
}

export function createLLMService(config: AppConfig): LLMService {
  return new LLMService(config);
}
