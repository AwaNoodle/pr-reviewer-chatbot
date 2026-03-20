import { describe, expect, it, vi } from 'vitest';
import { GitHubApiError } from '../services/github';
import { loadPullRequestContext } from './loadPullRequestContext';
import { runEffect } from './runtime';

const mockPR = {
  id: 1,
  number: 42,
  title: 'Test PR',
  body: null,
  state: 'open' as const,
  merged: false,
  merged_at: null,
  user: { login: 'alice', avatar_url: '', html_url: '' },
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  head: { ref: 'feature', sha: 'abc', repo: { full_name: 'org/repo' } },
  base: { ref: 'main', sha: 'def', repo: { full_name: 'org/repo' } },
  url: '',
  html_url: '',
  diff_url: '',
  additions: 10,
  deletions: 2,
  changed_files: 1,
  comments: 0,
  review_comments: 0,
  commits: 1,
  labels: [],
  requested_reviewers: [],
};

function createMockService() {
  return {
    getPullRequest: vi.fn().mockResolvedValue(mockPR),
    getPRFiles: vi.fn().mockResolvedValue([]),
    getPRComments: vi.fn().mockResolvedValue([]),
    getPRReviewComments: vi.fn().mockResolvedValue([]),
    getPRReviews: vi.fn().mockResolvedValue([]),
    getPRCommits: vi.fn().mockResolvedValue([]),
  };
}

describe('loadPullRequestContext', () => {
  it('loads metadata and all related resources', async () => {
    const service = createMockService();

    const result = await runEffect(
      loadPullRequestContext(service, {
        owner: 'org',
        repo: 'repo',
        prNumber: 42,
      })
    );

    expect(result.pullRequest.number).toBe(42);
    expect(result.files).toEqual([]);
    expect(result.comments).toEqual([]);
    expect(result.reviewComments).toEqual([]);
    expect(result.reviews).toEqual([]);
    expect(result.commits).toEqual([]);
    expect(service.getPullRequest).toHaveBeenCalledWith('org', 'repo', 42);
  });

  it('preserves GitHubApiError as typed error', async () => {
    const service = createMockService();
    service.getPullRequest.mockRejectedValueOnce(
      new GitHubApiError({
        code: 'NOT_FOUND',
        status: 404,
        message: 'Not Found',
        userMessage: 'The requested GitHub resource was not found. Check owner, repo, and PR number.',
      })
    );

    await expect(
      runEffect(
        loadPullRequestContext(
          service,
          {
            owner: 'org',
            repo: 'repo',
            prNumber: 42,
          },
          { retries: 0 }
        )
      )
    ).rejects.toMatchObject({ _tag: 'GitHubApiError' });
  });

  it('fails with timeout error when request exceeds policy timeout', async () => {
    const service = createMockService();
    service.getPullRequest.mockImplementationOnce(() => new Promise(() => undefined));

    await expect(
      runEffect(
        loadPullRequestContext(
          service,
          {
            owner: 'org',
            repo: 'repo',
            prNumber: 42,
          },
          { timeoutMs: 5, retries: 0 }
        )
      )
    ).rejects.toMatchObject({ _tag: 'TimeoutError' });
  });

  it('does not retry deterministic GitHub errors', async () => {
    const service = createMockService();
    service.getPullRequest.mockRejectedValue(
      new GitHubApiError({
        code: 'NOT_FOUND',
        status: 404,
        message: 'Not Found',
        userMessage: 'The requested GitHub resource was not found. Check owner, repo, and PR number.',
      })
    );

    await expect(
      runEffect(
        loadPullRequestContext(
          service,
          {
            owner: 'org',
            repo: 'repo',
            prNumber: 42,
          },
          { retries: 2 }
        )
      )
    ).rejects.toMatchObject({ _tag: 'GitHubApiError' });

    expect(service.getPullRequest).toHaveBeenCalledTimes(1);
  });

  it('retries transient network failures', async () => {
    const service = createMockService();
    service.getPullRequest
      .mockRejectedValueOnce(
        new GitHubApiError({
          code: 'NETWORK_ERROR',
          status: null,
          message: 'Network Error',
          userMessage:
            'Unable to reach GitHub. Check your network connection and GitHub instance setting.',
        })
      )
      .mockResolvedValueOnce(mockPR);

    const result = await runEffect(
      loadPullRequestContext(
        service,
        {
          owner: 'org',
          repo: 'repo',
          prNumber: 42,
        },
        { retries: 2 }
      )
    );

    expect(result.pullRequest.number).toBe(42);
    expect(service.getPullRequest).toHaveBeenCalledTimes(2);
  });
});
