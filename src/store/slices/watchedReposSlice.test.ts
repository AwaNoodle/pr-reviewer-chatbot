import { configureStore } from '@reduxjs/toolkit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import configReducer from './configSlice';
import chatReducer from './chatSlice';
import prsReducer from './prsSlice';
import watchedReposReducer, {
  addWatchedRepo,
  removeWatchedRepo,
  fetchWatchedRepoPRCount,
} from './watchedReposSlice';
import * as githubService from '../../services/github';

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

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
          githubPat: '',
          llmApiKey: '',
          githubInstance: 'github.com',
          llmBackend: 'openai' as const,
          llmEndpoint: 'https://api.openai.com/v1',
          llmModel: 'gpt-4o',
          demoMode: false,
          summaryEnabled: true,
          summaryPrompt: 'default summary prompt',
          summaryCommands: '',
        },
      },
      watchedRepos: {
        items: [],
      },
      chat: {
        messages: [],
        isStreaming: false,
        streamingMessageId: null,
        error: null,
      },
      prs: {
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
      },
    },
  });
}

describe('watchedReposSlice', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('adds and removes watched repositories', () => {
    const store = makeStore();

    store.dispatch(addWatchedRepo({ owner: 'org', repo: 'repo' }));
    expect(store.getState().watchedRepos.items).toHaveLength(1);
    expect(store.getState().watchedRepos.items[0].fullName).toBe('org/repo');

    store.dispatch(removeWatchedRepo('org/repo'));
    expect(store.getState().watchedRepos.items).toHaveLength(0);
  });

  it('persists watched repositories to localStorage', () => {
    const store = makeStore();

    store.dispatch(addWatchedRepo({ owner: 'org', repo: 'repo' }));
    const raw = localStorageMock.getItem('pr-review-chatbot-watched-repos');

    expect(raw).toContain('org');
    expect(raw).toContain('repo');
  });

  it('fetches and stores open PR counts for watched repositories', async () => {
    const store = makeStore();
    store.dispatch(addWatchedRepo({ owner: 'org', repo: 'repo' }));

    const service = {
      listPullRequests: vi.fn().mockResolvedValueOnce([{ id: 1 }, { id: 2 }]).mockResolvedValueOnce([]),
    };
    vi.spyOn(githubService, 'createGitHubService').mockReturnValue(
      service as unknown as ReturnType<typeof githubService.createGitHubService>
    );

    await store.dispatch(fetchWatchedRepoPRCount({ owner: 'org', repo: 'repo' }));

    expect(store.getState().watchedRepos.items[0].openPRCount).toBe(2);
  });
});
