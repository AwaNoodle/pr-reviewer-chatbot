import { configureStore } from '@reduxjs/toolkit';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import prsReducer, {
  setSelectedPR,
  setPRFiles,
  setPRComments,
  setPRReviewComments,
  setPRReviews,
  setPRCommits,
  setLoading,
  setError,
  resetSummaryState,
  fetchPullRequest,
  fetchPRFiles,
  fetchPRComments,
  fetchPRCommits,
  generatePRSummary,
} from './prsSlice';
import configReducer from './configSlice';
import chatReducer from './chatSlice';
import type { PullRequest, PRFile, PRComment, PRReviewComment, PRReview, PRCommit } from '../../types';
import * as githubService from '../../services/github';
import * as llmServiceModule from '../../services/llm';

const mockPR: PullRequest = {
  id: 1,
  number: 42,
  title: 'Test PR',
  body: null,
  state: 'open',
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

const mockFile: PRFile = {
  sha: 'aaa',
  filename: 'src/foo.ts',
  status: 'added',
  additions: 5,
  deletions: 0,
  changes: 5,
  contents_url: '',
  patch: '@@ -0,0 +1 @@\n+export const foo = 1;',
};

const mockComment: PRComment = {
  id: 1,
  body: 'LGTM',
  user: { login: 'bob', avatar_url: '', html_url: '' },
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  html_url: '',
};

const mockReviewComment: PRReviewComment = {
  id: 10,
  body: 'Nit: rename this variable',
  user: { login: 'carol', avatar_url: '', html_url: '' },
  created_at: '2024-01-02T00:00:00Z',
  updated_at: '2024-01-02T00:00:00Z',
  html_url: '',
  path: 'src/foo.ts',
  position: 3,
  original_position: 2,
  diff_hunk: '@@ -1,3 +1,4 @@',
  commit_id: 'abc123',
  pull_request_review_id: 20,
};

const mockReview: PRReview = {
  id: 20,
  user: { login: 'dave', avatar_url: '', html_url: '' },
  body: 'Looks good overall',
  state: 'APPROVED',
  submitted_at: '2024-01-03T00:00:00Z',
  html_url: '',
};

const mockCommit: PRCommit = {
  sha: 'commit-sha-1',
  commit: { message: 'feat: add summary support' },
  html_url: '',
};

const emptyState = {
  selectedPR: null,
  files: [],
  comments: [],
  reviewComments: [],
  reviews: [],
  commits: [],
  summary: {
    status: 'idle' as const,
    content: null,
    generatedAt: null,
    error: null,
    requestKey: null,
  },
  isLoading: false,
  error: null,
  loadingByResource: {
    metadata: false,
    files: false,
    comments: false,
    reviewComments: false,
    reviews: false,
    commits: false,
  },
  errorByResource: {
    metadata: null,
    files: null,
    comments: null,
    reviewComments: null,
    reviews: null,
    commits: null,
  },
};

type MockGitHubService = {
  getPullRequest: ReturnType<typeof vi.fn>;
  getPRFiles: ReturnType<typeof vi.fn>;
  getPRComments: ReturnType<typeof vi.fn>;
  getPRReviewComments: ReturnType<typeof vi.fn>;
  getPRReviews: ReturnType<typeof vi.fn>;
  getPRCommits: ReturnType<typeof vi.fn>;
};

function makeStore() {
  return configureStore({
    reducer: {
      config: configReducer,
      chat: chatReducer,
      prs: prsReducer,
    },
    preloadedState: {
      config: {
        config: {
          githubPat: 'ghp_test',
          llmApiKey: 'test-key',
          githubInstance: 'github.com',
          llmBackend: 'openai' as const,
          llmEndpoint: 'https://api.openai.com/v1',
          llmModel: 'gpt-4o',
          demoMode: false,
          summaryEnabled: true,
          summaryPrompt: 'Summarize this PR clearly',
          summaryCommands: '',
        },
      },
      chat: {
        messages: [],
        isStreaming: false,
        streamingMessageId: null,
        error: null,
      },
    },
  });
}

function setupMockService(): MockGitHubService {
  const service = {
    getPullRequest: vi.fn(),
    getPRFiles: vi.fn(),
    getPRComments: vi.fn(),
    getPRReviewComments: vi.fn(),
    getPRReviews: vi.fn(),
    getPRCommits: vi.fn(),
  };
  vi.spyOn(githubService, 'createGitHubService').mockReturnValue(
    service as unknown as ReturnType<typeof githubService.createGitHubService>
  );
  return service;
}

describe('prsSlice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('reducers', () => {
    it('sets selected PR', () => {
      const next = prsReducer(emptyState, setSelectedPR(mockPR));
      expect(next.selectedPR).toEqual(mockPR);
    });

    it('clears related state when selected PR is set to null', () => {
      const populated = {
        ...emptyState,
        selectedPR: mockPR,
        files: [mockFile],
        comments: [mockComment],
        reviewComments: [mockReviewComment],
        reviews: [mockReview],
        commits: [mockCommit],
      };
      const next = prsReducer(populated, setSelectedPR(null));
      expect(next.selectedPR).toBeNull();
      expect(next.files).toHaveLength(0);
      expect(next.comments).toHaveLength(0);
      expect(next.reviews).toHaveLength(0);
      expect(next.commits).toHaveLength(0);
      expect(next.summary.status).toBe('idle');
    });

    it('sets commits and can reset summary state', () => {
      const withCommits = prsReducer(emptyState, setPRCommits([mockCommit]));
      expect(withCommits.commits).toHaveLength(1);

      const withSummary = {
        ...withCommits,
        summary: {
          status: 'success' as const,
          content: 'Summary',
          generatedAt: 123,
          error: null,
          requestKey: 'abc',
        },
      };
      const reset = prsReducer(withSummary, resetSummaryState());
      expect(reset.summary.status).toBe('idle');
      expect(reset.summary.content).toBeNull();
    });

    it('supports existing list setters', () => {
      expect(prsReducer(emptyState, setPRFiles([mockFile])).files).toHaveLength(1);
      expect(prsReducer(emptyState, setPRComments([mockComment])).comments).toHaveLength(1);
      expect(prsReducer(emptyState, setPRReviewComments([mockReviewComment])).reviewComments).toHaveLength(1);
      expect(prsReducer(emptyState, setPRReviews([mockReview])).reviews).toHaveLength(1);
    });

    it('supports setLoading and setError reducers', () => {
      expect(prsReducer(emptyState, setLoading(true)).isLoading).toBe(true);
      expect(prsReducer({ ...emptyState, isLoading: true }, setError('boom')).isLoading).toBe(false);
    });
  });

  describe('async thunks', () => {
    it('loads metadata, files, comments, and commits', async () => {
      const store = makeStore();
      const service = setupMockService();
      service.getPullRequest.mockResolvedValueOnce(mockPR);
      service.getPRFiles.mockResolvedValueOnce([mockFile]);
      service.getPRComments.mockResolvedValueOnce([mockComment]);
      service.getPRCommits.mockResolvedValueOnce([mockCommit]);

      await store.dispatch(fetchPullRequest({ owner: 'org', repo: 'repo', prNumber: 42 }));
      await store.dispatch(fetchPRFiles({ owner: 'org', repo: 'repo', prNumber: 42 }));
      await store.dispatch(fetchPRComments({ owner: 'org', repo: 'repo', prNumber: 42 }));
      await store.dispatch(fetchPRCommits({ owner: 'org', repo: 'repo', prNumber: 42 }));

      expect(store.getState().prs.selectedPR?.number).toBe(42);
      expect(store.getState().prs.files).toHaveLength(1);
      expect(store.getState().prs.comments).toHaveLength(1);
      expect(store.getState().prs.commits).toHaveLength(1);
    });

    it('stores user-friendly errors for resource failures', async () => {
      const store = makeStore();
      const service = setupMockService();
      service.getPRFiles.mockRejectedValueOnce(
        new githubService.GitHubApiError({
          code: 'RATE_LIMITED',
          status: 403,
          message: 'API rate limit exceeded',
          userMessage: 'GitHub rate limit reached. Wait and retry.',
        })
      );

      await store.dispatch(fetchPRFiles({ owner: 'org', repo: 'repo', prNumber: 42 }));

      expect(store.getState().prs.errorByResource.files).toBe('GitHub rate limit reached. Wait and retry.');
      expect(store.getState().prs.error).toBe('GitHub rate limit reached. Wait and retry.');
    });

    it('runs summary generation and updates summary lifecycle state', async () => {
      const store = makeStore();
      const service = setupMockService();
      service.getPullRequest.mockResolvedValueOnce(mockPR);
      service.getPRFiles.mockResolvedValueOnce([mockFile]);
      service.getPRComments.mockResolvedValueOnce([]);
      service.getPRCommits.mockResolvedValueOnce([mockCommit]);
      service.getPRReviewComments.mockResolvedValueOnce([]);
      service.getPRReviews.mockResolvedValueOnce([]);

      vi.spyOn(llmServiceModule, 'createLLMService').mockReturnValue({
        buildSummaryPrompt: vi.fn().mockReturnValue('summary prompt'),
        chat: vi.fn().mockResolvedValue('Generated summary output'),
      } as unknown as ReturnType<typeof llmServiceModule.createLLMService>);

      await store.dispatch(fetchPullRequest({ owner: 'org', repo: 'repo', prNumber: 42 }));
      await store.dispatch(fetchPRFiles({ owner: 'org', repo: 'repo', prNumber: 42 }));
      await store.dispatch(fetchPRComments({ owner: 'org', repo: 'repo', prNumber: 42 }));
      await store.dispatch(fetchPRCommits({ owner: 'org', repo: 'repo', prNumber: 42 }));

      const pending = store.dispatch(generatePRSummary({ owner: 'org', repo: 'repo', prNumber: 42 }));
      expect(store.getState().prs.summary.status).toBe('loading');

      await pending;
      expect(store.getState().prs.summary.status).toBe('success');
      expect(store.getState().prs.summary.content).toContain('Generated summary output');
    });
  });
});
