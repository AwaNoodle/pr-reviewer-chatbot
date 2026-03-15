import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';
import { GitHubService, parseGitHubError, GitHubApiError } from './github';
import type { AppConfig, PRFile } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    githubPat: '',
    llmApiKey: '',
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

// Helper to read the private axios baseURL
function getBaseURL(service: GitHubService): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (service as any).client.defaults.baseURL as string;
}

// ---------------------------------------------------------------------------
// URL routing tests
// ---------------------------------------------------------------------------

describe('GitHubService — URL routing', () => {
  describe('when VITE_USE_PROXY is not "false" (default)', () => {
    beforeEach(() => {
      // Default: import.meta.env.VITE_USE_PROXY is undefined → proxy enabled
      vi.stubEnv('VITE_USE_PROXY', '');
    });

    it('uses the /api/github proxy path for github.com', () => {
      const svc = new GitHubService(makeConfig({ githubInstance: 'github.com' }));
      expect(getBaseURL(svc)).toBe('/api/github');
    });

    it('uses the /api/github proxy path for GHES instances', () => {
      const svc = new GitHubService(makeConfig({ githubInstance: 'github.mycompany.com' }));
      expect(getBaseURL(svc)).toBe('/api/github');
    });
  });

  describe('when VITE_USE_PROXY is "false" (direct mode)', () => {
    beforeEach(() => {
      vi.stubEnv('VITE_USE_PROXY', 'false');
    });

    it('uses https://api.github.com for github.com', () => {
      const svc = new GitHubService(makeConfig({ githubInstance: 'github.com' }));
      expect(getBaseURL(svc)).toBe('https://api.github.com');
    });

    it('uses https://api.github.com for api.github.com', () => {
      const svc = new GitHubService(makeConfig({ githubInstance: 'api.github.com' }));
      expect(getBaseURL(svc)).toBe('https://api.github.com');
    });

    it('uses GHES /api/v3 path for custom hostnames', () => {
      const svc = new GitHubService(makeConfig({ githubInstance: 'github.mycompany.com' }));
      expect(getBaseURL(svc)).toBe('https://github.mycompany.com/api/v3');
    });

    it('strips https:// protocol prefix from the instance URL', () => {
      const svc = new GitHubService(makeConfig({ githubInstance: 'https://github.mycompany.com' }));
      expect(getBaseURL(svc)).toBe('https://github.mycompany.com/api/v3');
    });

    it('strips http:// protocol prefix from the instance URL', () => {
      const svc = new GitHubService(makeConfig({ githubInstance: 'http://github.mycompany.com' }));
      expect(getBaseURL(svc)).toBe('https://github.mycompany.com/api/v3');
    });
  });
});

// ---------------------------------------------------------------------------
// Authorization header tests
// ---------------------------------------------------------------------------

describe('GitHubService — Authorization header', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_USE_PROXY', '');
  });

  it('sets Bearer token header when PAT is provided', () => {
    const svc = new GitHubService(makeConfig({ githubPat: 'ghp_mytoken' }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const headers = (svc as any).client.defaults.headers as Record<string, unknown>;
    expect(headers['Authorization']).toBe('Bearer ghp_mytoken');
  });

  it('does not set Authorization header when PAT is empty', () => {
    const svc = new GitHubService(makeConfig({ githubPat: '' }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const headers = (svc as any).client.defaults.headers as Record<string, unknown>;
    expect(headers['Authorization']).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// validateToken tests
// ---------------------------------------------------------------------------

describe('GitHubService — validateToken', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_USE_PROXY', '');
  });

  it('returns true when the /user request succeeds', async () => {
    const svc = new GitHubService(makeConfig());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn((svc as any).client, 'get').mockResolvedValueOnce({ data: { login: 'alice' } });
    expect(await svc.validateToken()).toBe(true);
  });

  it('returns false when the /user request throws', async () => {
    const svc = new GitHubService(makeConfig());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn((svc as any).client, 'get').mockRejectedValueOnce(new Error('401'));
    expect(await svc.validateToken()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// PR file pagination tests
// ---------------------------------------------------------------------------

describe('GitHubService — getPRFiles pagination', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_USE_PROXY', '');
  });

  function buildFile(index: number): PRFile {
    return {
      sha: `sha-${index}`,
      filename: `src/file-${index}.ts`,
      status: 'modified',
      additions: 1,
      deletions: 1,
      changes: 2,
      contents_url: `https://example.test/${index}`,
    };
  }

  it('fetches all pages when a pull request has more than 100 files', async () => {
    const svc = new GitHubService(makeConfig());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const getSpy = vi.spyOn((svc as any).client, 'get');

    const pageOne = Array.from({ length: 100 }, (_, i) => buildFile(i + 1));
    const pageTwo = Array.from({ length: 100 }, (_, i) => buildFile(i + 101));
    const pageThree = Array.from({ length: 2 }, (_, i) => buildFile(i + 201));

    getSpy
      .mockResolvedValueOnce({ data: pageOne })
      .mockResolvedValueOnce({ data: pageTwo })
      .mockResolvedValueOnce({ data: pageThree });

    const files = await svc.getPRFiles('org', 'repo', 123);

    expect(files).toHaveLength(202);
    expect(files[0].filename).toBe('src/file-1.ts');
    expect(files[201].filename).toBe('src/file-202.ts');
    expect(getSpy).toHaveBeenCalledTimes(3);
    expect(getSpy).toHaveBeenNthCalledWith(
      1,
      '/repos/org/repo/pulls/123/files',
      expect.objectContaining({ params: expect.objectContaining({ per_page: 100, page: 1 }) })
    );
    expect(getSpy).toHaveBeenNthCalledWith(
      2,
      '/repos/org/repo/pulls/123/files',
      expect.objectContaining({ params: expect.objectContaining({ per_page: 100, page: 2 }) })
    );
    expect(getSpy).toHaveBeenNthCalledWith(
      3,
      '/repos/org/repo/pulls/123/files',
      expect.objectContaining({ params: expect.objectContaining({ per_page: 100, page: 3 }) })
    );
  });
});

describe('GitHubService — getPRCommits', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_USE_PROXY', '');
  });

  it('fetches commit messages for a pull request', async () => {
    const svc = new GitHubService(makeConfig());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const getSpy = vi.spyOn((svc as any).client, 'get');

    getSpy.mockResolvedValueOnce({
      data: [
        {
          sha: 'abc123',
          commit: { message: 'feat: add summary tab' },
          html_url: 'https://github.com/org/repo/commit/abc123',
        },
      ],
    });

    const commits = await svc.getPRCommits('org', 'repo', 123);

    expect(commits).toHaveLength(1);
    expect(commits[0].commit.message).toBe('feat: add summary tab');
    expect(getSpy).toHaveBeenCalledWith(
      '/repos/org/repo/pulls/123/commits',
      expect.objectContaining({ params: expect.objectContaining({ per_page: 100, page: 1 }) })
    );
  });
});

// ---------------------------------------------------------------------------
// Error parsing tests
// ---------------------------------------------------------------------------

function makeAxiosError(
  status: number,
  data: Record<string, unknown>,
  headers: Record<string, string> = {}
): AxiosError {
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', undefined, undefined, {
    data,
    status,
    statusText: String(status),
    headers: AxiosHeaders.from(headers),
    config: {
      headers: AxiosHeaders.from({}),
    },
  });
}

describe('parseGitHubError', () => {
  it('maps authentication failures to a typed auth error', () => {
    const error = makeAxiosError(401, { message: 'Bad credentials' });
    const parsed = parseGitHubError(error);

    expect(parsed).toBeInstanceOf(GitHubApiError);
    expect(parsed.code).toBe('AUTHENTICATION_ERROR');
    expect(parsed.status).toBe(401);
    expect(parsed.userMessage).toContain('Personal Access Token');
  });

  it('maps rate limiting failures and extracts reset metadata', () => {
    const error = makeAxiosError(
      403,
      { message: 'API rate limit exceeded' },
      {
        'x-ratelimit-remaining': '0',
        'x-ratelimit-reset': '1735689600',
        'retry-after': '60',
      }
    );

    const parsed = parseGitHubError(error);

    expect(parsed.code).toBe('RATE_LIMITED');
    expect(parsed.retryAfterSeconds).toBe(60);
    expect(parsed.rateLimitResetAt).toBe('2025-01-01T00:00:00.000Z');
  });

  it('maps network errors when no response is present', () => {
    const error = new AxiosError('Network Error', 'ERR_NETWORK');
    const parsed = parseGitHubError(error);

    expect(parsed.code).toBe('NETWORK_ERROR');
    expect(parsed.status).toBeNull();
    expect(parsed.userMessage).toContain('Unable to reach GitHub');
  });
});
