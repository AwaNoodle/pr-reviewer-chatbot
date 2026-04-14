import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ChatWindow } from './ChatWindow';
import chatReducer from '../store/slices/chatSlice';
import configReducer from '../store/slices/configSlice';
import prsReducer, { setSelectedPR } from '../store/slices/prsSlice';
import type { AppConfig, PullRequest } from '../types';
import * as llmServiceModule from '../services/llm';

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
  head: { ref: 'feature', sha: 'sha-1', repo: { full_name: 'org/repo' } },
  base: { ref: 'main', sha: 'base-1', repo: { full_name: 'org/repo' } },
  url: '',
  html_url: '',
  diff_url: '',
  additions: 1,
  deletions: 0,
  changed_files: 1,
  comments: 0,
  review_comments: 0,
  commits: 1,
  labels: [],
  requested_reviewers: [],
};

function makeStore(configOverrides: Partial<AppConfig> = {}) {
  return configureStore({
    reducer: {
      chat: chatReducer,
      config: configReducer,
      prs: prsReducer,
    },
    preloadedState: {
      config: {
        config: {
          githubPat: '',
          llmApiKey: 'test-key',
          githubInstance: 'github.com',
          llmBackend: 'openai' as const,
          llmEndpoint: 'https://api.openai.com/v1',
          llmModel: 'gpt-4o',
          demoMode: false,
          summaryEnabled: true,
          summaryPrompt: 'summary prompt',
          summaryCommands: '',
          ...configOverrides,
        },
      },
      prs: {
        selectedPR: mockPR,
        activeRepository: { owner: 'org', repo: 'repo' },
        prList: [],
        files: [
          {
            sha: 'file-1',
            filename: 'src/file.ts',
            status: 'added' as const,
            additions: 1,
            deletions: 0,
            changes: 1,
            contents_url: '',
            patch: '@@ -0,0 +1 @@\n+const x = 1;',
          },
        ],
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
          citations: [],
          hasUncitedContent: false,
        },
        signals: {
          status: 'idle' as const,
          data: null,
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
        focusedFileIndex: null,
        focusedFileLine: null,
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

describe('ChatWindow stream cancellation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('aborts in-flight streams when selected PR changes and clears streaming state', async () => {
    const store = makeStore();

    vi.spyOn(llmServiceModule, 'createLLMService').mockReturnValue({
      buildSystemPrompt: vi.fn().mockReturnValue('system prompt'),
      chatStream: vi.fn(async function* (_messages: unknown, options?: { signal?: AbortSignal }) {
        yield 'first chunk';

        await new Promise<void>((_resolve, reject) => {
          if (options?.signal?.aborted) {
            const abortError = new Error('aborted');
            abortError.name = 'AbortError';
            reject(abortError);
            return;
          }

          options?.signal?.addEventListener(
            'abort',
            () => {
              const abortError = new Error('aborted');
              abortError.name = 'AbortError';
              reject(abortError);
            },
            { once: true }
          );
        });

        yield 'late chunk';
      }),
    } as unknown as ReturnType<typeof llmServiceModule.createLLMService>);

    render(
      <Provider store={store}>
        <ChatWindow />
      </Provider>
    );

    fireEvent.change(screen.getByPlaceholderText(/ask about this pr/i), {
      target: { value: 'Please review this' },
    });
    fireEvent.click(screen.getByTitle('Send message'));

    await waitFor(() => {
      expect(store.getState().chat.isStreaming).toBe(true);
    });

    await act(async () => {
      store.dispatch(
        setSelectedPR({
          ...mockPR,
          id: 2,
          number: 43,
          title: 'Other PR',
          head: { ...mockPR.head, sha: 'sha-2' },
        })
      );
    });

    await waitFor(() => {
      expect(store.getState().chat.isStreaming).toBe(false);
      expect(store.getState().chat.messages).toHaveLength(0);
    });
  });
});

describe('ChatWindow status and errors', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('does not show a key configuration warning when api key is empty', () => {
    const store = makeStore({ llmApiKey: '' });

    render(
      <Provider store={store}>
        <ChatWindow />
      </Provider>
    );

    expect(screen.queryByText(/configure llm api key/i)).not.toBeInTheDocument();
    expect(screen.getByText('Using gpt-4o via openai')).toBeInTheDocument();
  });

  it('shows provider 4xx errors in the assistant message bubble', async () => {
    const store = makeStore();

    vi.spyOn(llmServiceModule, 'createLLMService').mockReturnValue({
      buildSystemPrompt: vi.fn().mockReturnValue('system prompt'),
      chatStream: vi.fn(async function* (_messages: unknown, options?: { signal?: AbortSignal }) {
        if (options?.signal?.aborted) {
          yield '';
        }
        throw new Error('LLM API error 401: Unauthorized');
      }),
    } as unknown as ReturnType<typeof llmServiceModule.createLLMService>);

    render(
      <Provider store={store}>
        <ChatWindow />
      </Provider>
    );

    fireEvent.change(screen.getByPlaceholderText(/ask about this pr/i), {
      target: { value: 'Please review this' },
    });
    fireEvent.click(screen.getByTitle('Send message'));

    await waitFor(() => {
      expect(screen.getByText('LLM API error 401: Unauthorized')).toBeInTheDocument();
    });
  });
});

describe('ChatWindow stream fallbacks', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('falls back to non-stream chat when stream yields no visible output', async () => {
    const store = makeStore();
    const chatMock = vi.fn().mockResolvedValue('Fallback answer from non-stream call');

    vi.spyOn(llmServiceModule, 'createLLMService').mockReturnValue({
      buildSystemPrompt: vi.fn().mockReturnValue('system prompt'),
      chat: chatMock,
      chatStream: vi.fn(async function* (_messages: unknown, options?: { signal?: AbortSignal }) {
        if (options?.signal?.aborted) {
          yield '';
        }
      }),
    } as unknown as ReturnType<typeof llmServiceModule.createLLMService>);

    render(
      <Provider store={store}>
        <ChatWindow />
      </Provider>
    );

    fireEvent.change(screen.getByPlaceholderText(/ask about this pr/i), {
      target: { value: 'Please review this' },
    });
    fireEvent.click(screen.getByTitle('Send message'));

    await waitFor(() => {
      expect(screen.getByText('Fallback answer from non-stream call')).toBeInTheDocument();
    });

    expect(chatMock).toHaveBeenCalledTimes(1);
    expect(store.getState().chat.isStreaming).toBe(false);
  });
});
