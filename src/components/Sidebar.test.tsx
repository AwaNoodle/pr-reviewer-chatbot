import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Sidebar } from './Sidebar';
import configReducer from '../store/slices/configSlice';
import prsReducer from '../store/slices/prsSlice';
import chatReducer from '../store/slices/chatSlice';
import watchedReposReducer from '../store/slices/watchedReposSlice';
import * as githubService from '../services/github';

function renderSidebar(options?: { summaryEnabled?: boolean }) {
  const store = configureStore({
    reducer: {
      config: configReducer,
      prs: prsReducer,
      chat: chatReducer,
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
          summaryEnabled: options?.summaryEnabled ?? false,
          summaryPrompt: 'default summary prompt',
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

  return render(
    <Provider store={store}>
      <Sidebar />
    </Provider>
  );
}

describe('Sidebar repository list flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('changes load button text based on PR number input', () => {
    renderSidebar();

    expect(screen.getByText('Load All PRs')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('PR Number'), { target: { value: '42' } });
    expect(screen.getByText('Load PR')).toBeInTheDocument();
  });

  it('loads all pull requests when PR number is empty', async () => {
    const service = {
      listPullRequests: vi
        .fn()
        .mockResolvedValueOnce([
          {
            id: 1,
            number: 12,
            title: 'Fix list flow',
            state: 'open',
            merged: false,
            user: { login: 'alice', avatar_url: '', html_url: '' },
            updated_at: '2024-01-01T00:00:00Z',
            base: { ref: 'main', sha: 'abc', repo: { full_name: 'org/repo' } },
            head: { ref: 'feat', sha: 'def', repo: { full_name: 'org/repo' } },
          },
        ])
        .mockResolvedValueOnce([]),
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

    renderSidebar();

    fireEvent.change(screen.getByLabelText('Repository'), { target: { value: 'org/repo' } });
    fireEvent.click(screen.getByText('Load All PRs'));

    expect(await screen.findByText('Back')).toBeInTheDocument();
    expect(await screen.findByText('Fix list flow')).toBeInTheDocument();
  });

  it('selects PR from list and loads details in right pane state', async () => {
    const listPR = {
      id: 1,
      number: 12,
      title: 'Fix list flow',
      state: 'open',
      merged: false,
      user: { login: 'alice', avatar_url: '', html_url: '' },
      updated_at: '2024-01-01T00:00:00Z',
      base: { ref: 'main', sha: 'abc', repo: { full_name: 'org/repo' } },
      head: { ref: 'feat', sha: 'def', repo: { full_name: 'org/repo' } },
    };
    const fullPR = {
      ...listPR,
      body: null,
      merged_at: null,
      created_at: '2024-01-01T00:00:00Z',
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
    const service = {
      listPullRequests: vi.fn().mockResolvedValueOnce([listPR]).mockResolvedValueOnce([]),
      getPullRequest: vi.fn().mockResolvedValueOnce(fullPR),
      getPRFiles: vi.fn().mockResolvedValueOnce([]),
      getPRComments: vi.fn().mockResolvedValueOnce([]),
      getPRReviewComments: vi.fn().mockResolvedValueOnce([]),
      getPRReviews: vi.fn().mockResolvedValueOnce([]),
      getPRCommits: vi.fn().mockResolvedValueOnce([]),
    };
    vi.spyOn(githubService, 'createGitHubService').mockReturnValue(
      service as unknown as ReturnType<typeof githubService.createGitHubService>
    );

    renderSidebar();

    fireEvent.change(screen.getByLabelText('Repository'), { target: { value: 'org/repo' } });
    fireEvent.click(screen.getByText('Load All PRs'));
    const prButton = await screen.findByText('Fix list flow');
    fireEvent.click(prButton);

    await waitFor(() => {
      expect(service.getPullRequest).toHaveBeenCalledWith('org', 'repo', 12);
    });
  });
});
