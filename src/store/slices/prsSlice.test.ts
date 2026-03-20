import { configureStore } from '@reduxjs/toolkit';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import prsReducer, {
  setSelectedPR,
  setPRFiles,
  setPRList,
  setActiveRepository,
  setPRComments,
  setPRReviewComments,
  setPRReviews,
  setPRCommits,
  setLoading,
  setError,
  resetSummaryState,
  fetchPullRequestContext,
  fetchRepositoryPRList,
  generatePRSummary,
} from './prsSlice';
import configReducer from './configSlice';
import chatReducer from './chatSlice';
import watchedReposReducer from './watchedReposSlice';
import type {
  PullRequest,
  PRFile,
  PRComment,
  PRReviewComment,
  PRReview,
  PRCommit,
  PRListItem,
} from '../../types';
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

const mockListItem: PRListItem = {
  id: mockPR.id,
  number: mockPR.number,
  title: mockPR.title,
  state: mockPR.state,
  merged: mockPR.merged,
  user: mockPR.user,
  updated_at: mockPR.updated_at,
  base: mockPR.base,
  head: mockPR.head,
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
  activeRepository: null,
  prList: [],
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
    prList: false,
  },
  errorByResource: {
    metadata: null,
    files: null,
    comments: null,
    reviewComments: null,
    reviews: null,
    commits: null,
    prList: null,
  },
  latestRequestKeyByResource: {
    metadata: null,
    files: null,
    comments: null,
    reviewComments: null,
    reviews: null,
    commits: null,
  },
};

type MockGitHubService = {
  listPullRequests: ReturnType<typeof vi.fn>;
  getPullRequest: ReturnType<typeof vi.fn>;
  getPRFiles: ReturnType<typeof vi.fn>;
  getPRComments: ReturnType<typeof vi.fn>;
  getPRReviewComments: ReturnType<typeof vi.fn>;
  getPRReviews: ReturnType<typeof vi.fn>;
  getPRCommits: ReturnType<typeof vi.fn>;
};

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

function makeStore() {
  return configureStore({
    reducer: {
      config: configReducer,
      chat: chatReducer,
      prs: prsReducer,
      watchedRepos: watchedReposReducer,
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
      watchedRepos: {
        items: [],
      },
    },
  });
}

function setupMockService(): MockGitHubService {
  const service = {
    listPullRequests: vi.fn(),
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

    it('supports PR list and repository reducers', () => {
      const withList = prsReducer(emptyState, setPRList([mockListItem]));
      expect(withList.prList).toHaveLength(1);

      const withRepo = prsReducer(withList, setActiveRepository({ owner: 'org', repo: 'repo' }));
      expect(withRepo.activeRepository).toEqual({ owner: 'org', repo: 'repo' });
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

    it('supports commits and summary reset', () => {
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
  });

  describe('async thunks', () => {
    it('loads metadata, files, comments, and commits', async () => {
      const store = makeStore();
      const service = setupMockService();
      service.getPullRequest.mockResolvedValueOnce(mockPR);
      service.getPRFiles.mockResolvedValueOnce([mockFile]);
      service.getPRComments.mockResolvedValueOnce([mockComment]);
      service.getPRReviewComments.mockResolvedValueOnce([mockReviewComment]);
      service.getPRReviews.mockResolvedValueOnce([mockReview]);
      service.getPRCommits.mockResolvedValueOnce([mockCommit]);

      await store.dispatch(fetchPullRequestContext({ owner: 'org', repo: 'repo', prNumber: 42 }));

      expect(store.getState().prs.selectedPR?.number).toBe(42);
      expect(store.getState().prs.files).toHaveLength(1);
      expect(store.getState().prs.comments).toHaveLength(1);
      expect(store.getState().prs.reviewComments).toHaveLength(1);
      expect(store.getState().prs.reviews).toHaveLength(1);
      expect(store.getState().prs.commits).toHaveLength(1);
      expect(store.getState().prs.error).toBeNull();
    });

    it('maps Effect failures to GitHub-style rejected payload', async () => {
      const store = makeStore();
      const service = setupMockService();

      service.getPullRequest.mockRejectedValue(
        new githubService.GitHubApiError({
          code: 'NOT_FOUND',
          status: 404,
          message: 'Not Found',
          userMessage: 'The requested GitHub resource was not found. Check owner, repo, and PR number.',
        })
      );

      const action = await store.dispatch(fetchPullRequestContext({ owner: 'org', repo: 'repo', prNumber: 42 }));

      expect(fetchPullRequestContext.rejected.match(action)).toBe(true);
      if (fetchPullRequestContext.rejected.match(action)) {
        expect(action.payload?.code).toBe('NOT_FOUND');
        expect(action.payload?.userMessage).toContain('not found');
      }
      expect(store.getState().prs.error).toContain('not found');
    });

    it('loads open pull requests for a repository', async () => {
      const store = makeStore();
      const service = setupMockService();

      service.listPullRequests.mockResolvedValueOnce([mockPR]).mockResolvedValueOnce([]);

      await store.dispatch(fetchRepositoryPRList({ owner: 'org', repo: 'repo' }));

      expect(store.getState().prs.prList).toHaveLength(1);
      expect(store.getState().prs.prList[0].number).toBe(42);
      expect(service.listPullRequests).toHaveBeenCalledWith('org', 'repo', 'open', 1, 100);
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

      await store.dispatch(fetchPullRequestContext({ owner: 'org', repo: 'repo', prNumber: 42 }));

      const pending = store.dispatch(generatePRSummary({ owner: 'org', repo: 'repo', prNumber: 42 }));
      expect(store.getState().prs.summary.status).toBe('loading');

      await pending;
      expect(store.getState().prs.summary.status).toBe('success');
      expect(store.getState().prs.summary.content).toContain('Generated summary output');
    });

    it('keeps latest PR resource data when older requests resolve later', async () => {
      const store = makeStore();
      const service = setupMockService();

      const prA = {
        ...mockPR,
        id: 101,
        number: 101,
        title: 'PR A',
        head: { ...mockPR.head, sha: 'sha-a' },
      };
      const prB = {
        ...mockPR,
        id: 202,
        number: 202,
        title: 'PR B',
        head: { ...mockPR.head, sha: 'sha-b' },
      };

      const fileA = { ...mockFile, sha: 'file-a', filename: 'src/a.ts' };
      const fileB = { ...mockFile, sha: 'file-b', filename: 'src/b.ts' };
      const commentA = { ...mockComment, id: 101, body: 'comment-a' };
      const commentB = { ...mockComment, id: 202, body: 'comment-b' };
      const reviewCommentA = { ...mockReviewComment, id: 301, body: 'review-comment-a' };
      const reviewCommentB = { ...mockReviewComment, id: 302, body: 'review-comment-b' };
      const reviewA = { ...mockReview, id: 401, body: 'review-a' };
      const reviewB = { ...mockReview, id: 402, body: 'review-b' };
      const commitA = { ...mockCommit, sha: 'commit-a', commit: { message: 'commit-a' } };
      const commitB = { ...mockCommit, sha: 'commit-b', commit: { message: 'commit-b' } };

      const deferred = {
        metadataA: createDeferred<PullRequest>(),
        metadataB: createDeferred<PullRequest>(),
        filesA: createDeferred<PRFile[]>(),
        filesB: createDeferred<PRFile[]>(),
        commentsA: createDeferred<PRComment[]>(),
        commentsB: createDeferred<PRComment[]>(),
        reviewCommentsA: createDeferred<PRReviewComment[]>(),
        reviewCommentsB: createDeferred<PRReviewComment[]>(),
        reviewsA: createDeferred<PRReview[]>(),
        reviewsB: createDeferred<PRReview[]>(),
        commitsA: createDeferred<PRCommit[]>(),
        commitsB: createDeferred<PRCommit[]>(),
      };

      service.getPullRequest.mockImplementation((_owner: string, _repo: string, prNumber: number) =>
        prNumber === 101 ? deferred.metadataA.promise : deferred.metadataB.promise
      );
      service.getPRFiles.mockImplementation((_owner: string, _repo: string, prNumber: number) =>
        prNumber === 101 ? deferred.filesA.promise : deferred.filesB.promise
      );
      service.getPRComments.mockImplementation((_owner: string, _repo: string, prNumber: number) =>
        prNumber === 101 ? deferred.commentsA.promise : deferred.commentsB.promise
      );
      service.getPRReviewComments.mockImplementation((_owner: string, _repo: string, prNumber: number) =>
        prNumber === 101 ? deferred.reviewCommentsA.promise : deferred.reviewCommentsB.promise
      );
      service.getPRReviews.mockImplementation((_owner: string, _repo: string, prNumber: number) =>
        prNumber === 101 ? deferred.reviewsA.promise : deferred.reviewsB.promise
      );
      service.getPRCommits.mockImplementation((_owner: string, _repo: string, prNumber: number) =>
        prNumber === 101 ? deferred.commitsA.promise : deferred.commitsB.promise
      );

      const requestA = store.dispatch(fetchPullRequestContext({ owner: 'org', repo: 'repo', prNumber: 101 }));
      const requestB = store.dispatch(fetchPullRequestContext({ owner: 'org', repo: 'repo', prNumber: 202 }));

      deferred.metadataB.resolve(prB);
      deferred.filesB.resolve([fileB]);
      deferred.commentsB.resolve([commentB]);
      deferred.reviewCommentsB.resolve([reviewCommentB]);
      deferred.reviewsB.resolve([reviewB]);
      deferred.commitsB.resolve([commitB]);
      await requestB;

      deferred.metadataA.resolve(prA);
      deferred.filesA.resolve([fileA]);
      deferred.commentsA.resolve([commentA]);
      deferred.reviewCommentsA.resolve([reviewCommentA]);
      deferred.reviewsA.resolve([reviewA]);
      deferred.commitsA.resolve([commitA]);
      await requestA;

      const state = store.getState().prs;
      expect(state.selectedPR?.number).toBe(202);
      expect(state.files[0]?.filename).toBe('src/b.ts');
      expect(state.comments[0]?.body).toBe('comment-b');
      expect(state.reviewComments[0]?.body).toBe('review-comment-b');
      expect(state.reviews[0]?.body).toBe('review-b');
      expect(state.commits[0]?.sha).toBe('commit-b');
    });
  });
});
