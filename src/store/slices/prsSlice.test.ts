import { configureStore } from '@reduxjs/toolkit';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import prsReducer, {
  setSelectedPR,
  setPRFiles,
  setPRComments,
  setPRReviewComments,
  setPRReviews,
  setLoading,
  setError,
  fetchPullRequest,
  fetchPRFiles,
  fetchPRComments,
} from './prsSlice';
import configReducer from './configSlice';
import chatReducer from './chatSlice';
import type { PullRequest, PRFile, PRComment, PRReviewComment, PRReview } from '../../types';
import * as githubService from '../../services/github';

// ---------------------------------------------------------------------------
// Minimal fixtures
// ---------------------------------------------------------------------------

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

const emptyState = {
  selectedPR: null,
  files: [],
  comments: [],
  reviewComments: [],
  reviews: [],
  isLoading: false,
  error: null,
  loadingByResource: {
    metadata: false,
    files: false,
    comments: false,
    reviewComments: false,
    reviews: false,
  },
  errorByResource: {
    metadata: null,
    files: null,
    comments: null,
    reviewComments: null,
    reviews: null,
  },
};

type MockGitHubService = {
  getPullRequest: ReturnType<typeof vi.fn>;
  getPRFiles: ReturnType<typeof vi.fn>;
  getPRComments: ReturnType<typeof vi.fn>;
  getPRReviewComments: ReturnType<typeof vi.fn>;
  getPRReviews: ReturnType<typeof vi.fn>;
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
  };
  vi.spyOn(githubService, 'createGitHubService').mockReturnValue(
    service as unknown as ReturnType<typeof githubService.createGitHubService>
  );
  return service;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('prsSlice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('setSelectedPR', () => {
    it('sets the selected PR', () => {
      const next = prsReducer(emptyState, setSelectedPR(mockPR));
      expect(next.selectedPR).toEqual(mockPR);
    });

    it('clears files, comments, reviewComments, and reviews when set to null', () => {
      const populated = {
        ...emptyState,
        selectedPR: mockPR,
        files: [mockFile],
        comments: [mockComment],
        reviewComments: [],
        reviews: [],
      };
      const next = prsReducer(populated, setSelectedPR(null));
      expect(next.selectedPR).toBeNull();
      expect(next.files).toHaveLength(0);
      expect(next.comments).toHaveLength(0);
      expect(next.reviewComments).toHaveLength(0);
      expect(next.reviews).toHaveLength(0);
    });

    it('does NOT clear related data when switching to a different PR', () => {
      // When a new PR is set (non-null), existing data is kept until explicitly replaced
      const populated = {
        ...emptyState,
        selectedPR: mockPR,
        files: [mockFile],
      };
      const anotherPR = { ...mockPR, id: 2, number: 43 };
      const next = prsReducer(populated, setSelectedPR(anotherPR));
      expect(next.selectedPR?.number).toBe(43);
      // files are NOT cleared — caller is responsible for loading new data
      expect(next.files).toHaveLength(1);
    });
  });

  describe('setPRFiles', () => {
    it('replaces the files array', () => {
      const next = prsReducer(emptyState, setPRFiles([mockFile]));
      expect(next.files).toHaveLength(1);
      expect(next.files[0].filename).toBe('src/foo.ts');
    });
  });

  describe('setPRComments', () => {
    it('replaces the comments array', () => {
      const next = prsReducer(emptyState, setPRComments([mockComment]));
      expect(next.comments).toHaveLength(1);
      expect(next.comments[0].body).toBe('LGTM');
    });
  });

  describe('setPRReviewComments', () => {
    it('replaces the reviewComments array', () => {
      const next = prsReducer(emptyState, setPRReviewComments([mockReviewComment]));
      expect(next.reviewComments).toHaveLength(1);
      expect(next.reviewComments[0].path).toBe('src/foo.ts');
      expect(next.reviewComments[0].body).toBe('Nit: rename this variable');
    });
  });

  describe('setPRReviews', () => {
    it('replaces the reviews array', () => {
      const next = prsReducer(emptyState, setPRReviews([mockReview]));
      expect(next.reviews).toHaveLength(1);
      expect(next.reviews[0].state).toBe('APPROVED');
      expect(next.reviews[0].body).toBe('Looks good overall');
    });
  });

  describe('setLoading', () => {
    it('sets isLoading to true', () => {
      const next = prsReducer(emptyState, setLoading(true));
      expect(next.isLoading).toBe(true);
    });

    it('sets isLoading to false', () => {
      const state = { ...emptyState, isLoading: true };
      const next = prsReducer(state, setLoading(false));
      expect(next.isLoading).toBe(false);
    });
  });

  describe('setError', () => {
    it('sets the error and clears isLoading', () => {
      const state = { ...emptyState, isLoading: true };
      const next = prsReducer(state, setError('Not found'));
      expect(next.error).toBe('Not found');
      expect(next.isLoading).toBe(false);
    });

    it('clears the error when null is passed', () => {
      const state = { ...emptyState, error: 'old error' };
      const next = prsReducer(state, setError(null));
      expect(next.error).toBeNull();
    });
  });

  describe('async thunks', () => {
    it('loads PR metadata and updates selected PR', async () => {
      const store = makeStore();
      const service = setupMockService();
      service.getPullRequest.mockResolvedValueOnce(mockPR);

      const actionPromise = store.dispatch(fetchPullRequest({ owner: 'org', repo: 'repo', prNumber: 42 }));

      expect(store.getState().prs.loadingByResource.metadata).toBe(true);
      expect(store.getState().prs.isLoading).toBe(true);

      await actionPromise;

      expect(store.getState().prs.selectedPR).toEqual(mockPR);
      expect(store.getState().prs.loadingByResource.metadata).toBe(false);
      expect(store.getState().prs.errorByResource.metadata).toBeNull();
      expect(store.getState().prs.isLoading).toBe(false);
    });

    it('loads files and updates granular loading state', async () => {
      const store = makeStore();
      const service = setupMockService();
      service.getPRFiles.mockResolvedValueOnce([mockFile]);

      const actionPromise = store.dispatch(fetchPRFiles({ owner: 'org', repo: 'repo', prNumber: 42 }));

      expect(store.getState().prs.loadingByResource.files).toBe(true);
      expect(store.getState().prs.isLoading).toBe(true);

      await actionPromise;

      expect(store.getState().prs.files).toEqual([mockFile]);
      expect(store.getState().prs.loadingByResource.files).toBe(false);
      expect(store.getState().prs.errorByResource.files).toBeNull();
      expect(store.getState().prs.isLoading).toBe(false);
    });

    it('stores user-friendly error when file load fails', async () => {
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
      expect(store.getState().prs.loadingByResource.files).toBe(false);
      expect(store.getState().prs.isLoading).toBe(false);
    });

    it('keeps aggregate loading true while another request is pending', async () => {
      const store = makeStore();
      const service = setupMockService();

      let resolveFiles: ((value: PRFile[]) => void) | null = null;
      service.getPRFiles.mockImplementationOnce(
        () =>
          new Promise<PRFile[]>((resolve) => {
            resolveFiles = resolve;
          })
      );
      service.getPRComments.mockResolvedValueOnce([mockComment]);

      const filesPromise = store.dispatch(fetchPRFiles({ owner: 'org', repo: 'repo', prNumber: 42 }));
      await store.dispatch(fetchPRComments({ owner: 'org', repo: 'repo', prNumber: 42 }));

      expect(store.getState().prs.loadingByResource.files).toBe(true);
      expect(store.getState().prs.loadingByResource.comments).toBe(false);
      expect(store.getState().prs.isLoading).toBe(true);

      if (!resolveFiles) {
        throw new Error('Expected files resolver to be assigned');
      }
      const resolve = resolveFiles as (value: PRFile[]) => void;
      resolve([mockFile]);
      await filesPromise;

      expect(store.getState().prs.loadingByResource.files).toBe(false);
      expect(store.getState().prs.isLoading).toBe(false);
    });
  });
});
