import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LLMService } from './llm';
import type { AppConfig, PRContext, PullRequest, PRFile } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    githubPat: '',
    llmApiKey: 'sk-test',
    githubInstance: 'github.com',
    llmBackend: 'openai',
    llmEndpoint: 'https://api.openai.com/v1',
    llmModel: 'gpt-4o',
    demoMode: false,
    summaryEnabled: true,
    summaryPrompt: 'default summary prompt',
    summaryCommands: '',
    ...overrides,
  };
}

const mockPR: PullRequest = {
  id: 1,
  number: 42,
  title: 'feat: Add JWT auth',
  body: 'Implements JWT authentication.',
  state: 'open',
  merged: false,
  merged_at: null,
  user: { login: 'alice', avatar_url: '', html_url: '' },
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  head: { ref: 'feature/jwt', sha: 'abc', repo: { full_name: 'org/repo' } },
  base: { ref: 'main', sha: 'def', repo: { full_name: 'org/repo' } },
  url: '',
  html_url: '',
  diff_url: '',
  additions: 50,
  deletions: 5,
  changed_files: 2,
  comments: 1,
  review_comments: 2,
  commits: 3,
  labels: [],
  requested_reviewers: [],
};

const mockFile: PRFile = {
  sha: 'aaa',
  filename: 'src/auth.ts',
  status: 'added',
  additions: 50,
  deletions: 0,
  changes: 50,
  contents_url: '',
  patch: '@@ -0,0 +1,3 @@\n+export function login() {}\n+export function logout() {}',
};

const mockContext: PRContext = {
  pr: mockPR,
  files: [mockFile],
  comments: [
    {
      id: 1,
      body: 'Looks good!',
      user: { login: 'bob', avatar_url: '', html_url: '' },
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      html_url: '',
    },
  ],
  reviewComments: [],
  reviews: [
    {
      id: 10,
      user: { login: 'carol', avatar_url: '', html_url: '' },
      body: 'LGTM',
      state: 'APPROVED',
      submitted_at: '2024-01-01T00:00:00Z',
      html_url: '',
    },
  ],
  commits: [
    {
      sha: 'abc123',
      commit: { message: 'feat: add JWT login flow\n\nIncludes middleware updates.' },
      html_url: '',
    },
  ],
};

// ---------------------------------------------------------------------------
// buildSystemPrompt tests
// ---------------------------------------------------------------------------

describe('LLMService.buildSystemPrompt', () => {
  const svc = new LLMService(makeConfig());

  it('includes the PR number and title', () => {
    const prompt = svc.buildSystemPrompt(mockContext);
    expect(prompt).toContain('#42');
    expect(prompt).toContain('feat: Add JWT auth');
  });

  it('includes the PR author', () => {
    const prompt = svc.buildSystemPrompt(mockContext);
    expect(prompt).toContain('alice');
  });

  it('includes the branch names', () => {
    const prompt = svc.buildSystemPrompt(mockContext);
    expect(prompt).toContain('feature/jwt');
    expect(prompt).toContain('main');
  });

  it('includes the file summary', () => {
    const prompt = svc.buildSystemPrompt(mockContext);
    expect(prompt).toContain('src/auth.ts');
    expect(prompt).toContain('+50/-0');
  });

  it('includes the diff content', () => {
    const prompt = svc.buildSystemPrompt(mockContext);
    expect(prompt).toContain('export function login()');
  });

  it('keeps PR metadata and file summaries when large diffs are omitted', () => {
    const smallPatchA = '@@ -0,0 +1,1 @@\n+const a = 1;';
    const hugePatch = `@@ -0,0 +1,1 @@\n+${'x'.repeat(40_000)}`;
    const smallPatchB = '@@ -0,0 +1,1 @@\n+const c = 3;';

    const files: PRFile[] = [
      { ...mockFile, filename: 'src/a.ts', patch: smallPatchA },
      { ...mockFile, filename: 'src/b.ts', patch: hugePatch },
      { ...mockFile, filename: 'src/c.ts', patch: smallPatchB },
    ];

    const prompt = svc.buildSystemPrompt({ ...mockContext, files });

    expect(prompt).toContain('## Pull Request: #42 - feat: Add JWT auth');
    expect(prompt).toContain('- src/a.ts');
    expect(prompt).toContain('- src/b.ts');
    expect(prompt).toContain('- src/c.ts');

    expect(prompt).toContain('const a = 1;');
    expect(prompt).toContain('const c = 3;');
    expect(prompt).not.toContain(hugePatch);
    expect(prompt).toContain('[Context budget] Omitted 1 diff(s): src/b.ts');
  });

  it('does not add omission message when all diffs fit in budget', () => {
    const prompt = svc.buildSystemPrompt(mockContext);
    expect(prompt).not.toContain('[Context budget] Omitted');
  });

  it('includes PR comments', () => {
    const prompt = svc.buildSystemPrompt(mockContext);
    expect(prompt).toContain('Looks good!');
    expect(prompt).toContain('bob');
  });

  it('includes reviews', () => {
    const prompt = svc.buildSystemPrompt(mockContext);
    expect(prompt).toContain('carol');
    expect(prompt).toContain('APPROVED');
  });

  it('omits the PR Comments section when there are no comments', () => {
    const ctx = { ...mockContext, comments: [] };
    const prompt = svc.buildSystemPrompt(ctx);
    expect(prompt).not.toContain('### PR Comments');
  });

  it('omits the Reviews section when there are no reviews', () => {
    const ctx = { ...mockContext, reviews: [] };
    const prompt = svc.buildSystemPrompt(ctx);
    expect(prompt).not.toContain('### Reviews');
  });

  it('shows "(no description)" when PR body is null', () => {
    const ctx = { ...mockContext, pr: { ...mockPR, body: null } };
    const prompt = svc.buildSystemPrompt(ctx);
    expect(prompt).toContain('(no description)');
  });

  it('shows "(merged)" when PR is merged', () => {
    const ctx = { ...mockContext, pr: { ...mockPR, merged: true } };
    const prompt = svc.buildSystemPrompt(ctx);
    expect(prompt).toContain('(merged)');
  });
});

describe('LLMService.buildSummaryPrompt', () => {
  const svc = new LLMService(makeConfig());

  it('includes user prompt, optional commands, commit messages, and format contract', () => {
    const prompt = svc.buildSummaryPrompt(
      mockContext,
      'Use concise wording for summaries.',
      '- Prioritize security changes\n- Mention migration risks'
    );

    expect(prompt).toContain('Use concise wording for summaries.');
    expect(prompt).toContain('Additional commands:');
    expect(prompt).toContain('Prioritize security changes');
    expect(prompt).toContain('feat: add JWT login flow');
    expect(prompt).toContain('orientation section of exactly 2-4 lines');
    expect(prompt).toContain('Focus Areas count must stay within 0-4 items');
    expect(prompt).toContain('where to review');
    expect(prompt).toContain('why it matters');
    expect(prompt).toContain('what to verify');
  });

  it('allows omitting additional commands and still enforces adaptive focus areas', () => {
    const prompt = svc.buildSummaryPrompt(mockContext, 'Keep this short.', '');
    expect(prompt).not.toContain('Additional commands:');
    expect(prompt).toContain('Add a "Focus Areas" section only when meaningful risk');
  });
});

// ---------------------------------------------------------------------------
// chat() tests — fetch mock
// ---------------------------------------------------------------------------

describe('LLMService.chat', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_USE_PROXY', '');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the assistant message content on success', async () => {
    const mockResponse = {
      id: 'chatcmpl-1',
      object: 'chat.completion',
      created: 1000,
      model: 'gpt-4o',
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: 'Hello from LLM' },
          finish_reason: 'stop',
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    };

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      })
    );

    const svc = new LLMService(makeConfig());
    const result = await svc.chat([{ role: 'user', content: 'Hi' }]);
    expect(result).toBe('Hello from LLM');
  });

  it('throws an error when the API returns a non-OK status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      })
    );

    const svc = new LLMService(makeConfig());
    await expect(svc.chat([{ role: 'user', content: 'Hi' }])).rejects.toThrow(
      'LLM API error 401'
    );
  });

  it('sends the Authorization header when an API key is configured', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'ok' } }],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const svc = new LLMService(makeConfig({ llmApiKey: 'sk-mykey' }));
    await svc.chat([{ role: 'user', content: 'Hi' }]);

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = options.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer sk-mykey');
  });

  it('does not send Authorization header when API key is empty', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'ok' } }],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const svc = new LLMService(makeConfig({ llmApiKey: '' }));
    await svc.chat([{ role: 'user', content: 'Hi' }]);

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = options.headers as Record<string, string>;
    expect(headers['Authorization']).toBeUndefined();
  });

  it('uses the /api/llm proxy path by default', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const svc = new LLMService(makeConfig());
    await svc.chat([{ role: 'user', content: 'Hi' }]);

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toMatch(/^\/api\/llm/);
  });

  it('uses the direct endpoint when VITE_LLM_USE_PROXY is "false"', async () => {
    vi.stubEnv('VITE_USE_PROXY', 'false');

    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const svc = new LLMService(makeConfig({ llmEndpoint: 'https://api.openai.com/v1' }));
    await svc.chat([{ role: 'user', content: 'Hi' }]);

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain('api.openai.com');
  });
});

// ---------------------------------------------------------------------------
// chatStream() tests — fetch mock with SSE
// ---------------------------------------------------------------------------

describe('LLMService.chatStream', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  function makeSSEStream(chunks: string[]): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    return new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      },
    });
  }

  it('yields content chunks from SSE stream', async () => {
    const sseData = [
      'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":" world"}}]}\n\n',
      'data: [DONE]\n\n',
    ];

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: true,
        body: makeSSEStream(sseData),
      })
    );

    const svc = new LLMService(makeConfig());
    const chunks: string[] = [];
    for await (const chunk of svc.chatStream([{ role: 'user', content: 'Hi' }])) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(['Hello', ' world']);
  });

  it('skips malformed JSON lines without throwing', async () => {
    const sseData = [
      'data: {"choices":[{"delta":{"content":"Good"}}]}\n\n',
      'data: {INVALID JSON}\n\n',
      'data: {"choices":[{"delta":{"content":"!"}}]}\n\n',
      'data: [DONE]\n\n',
    ];

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: true,
        body: makeSSEStream(sseData),
      })
    );

    const svc = new LLMService(makeConfig());
    const chunks: string[] = [];
    for await (const chunk of svc.chatStream([{ role: 'user', content: 'Hi' }])) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(['Good', '!']);
  });

  it('throws when the API returns a non-OK status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      })
    );

    const svc = new LLMService(makeConfig());
    const gen = svc.chatStream([{ role: 'user', content: 'Hi' }]);
    await expect(gen.next()).rejects.toThrow('LLM API error 500');
  });

  it('throws when response body is null', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: true,
        body: null,
      })
    );

    const svc = new LLMService(makeConfig());
    const gen = svc.chatStream([{ role: 'user', content: 'Hi' }]);
    await expect(gen.next()).rejects.toThrow('No response body for streaming');
  });
});
