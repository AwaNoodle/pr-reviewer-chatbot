import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Sidebar } from './Sidebar';
import configReducer from '../store/slices/configSlice';
import prsReducer from '../store/slices/prsSlice';
import chatReducer from '../store/slices/chatSlice';
import type { PullRequest } from '../types';

const selectedPRFixture: PullRequest = {
  id: 1,
  number: 42,
  title: 'Add refresh behavior coverage',
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
  additions: 5,
  deletions: 1,
  changed_files: 1,
  comments: 0,
  review_comments: 0,
  commits: 1,
  labels: [],
  requested_reviewers: [],
};

function renderSidebar(options?: {
  demoMode?: boolean;
  isLoading?: boolean;
  selectedPR?: PullRequest | null;
}) {
  const store = configureStore({
    reducer: {
      config: configReducer,
      prs: prsReducer,
      chat: chatReducer,
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
          demoMode: options?.demoMode ?? false,
        },
      },
      prs: {
        selectedPR: options?.selectedPR ?? null,
        files: [],
        comments: [],
        reviewComments: [],
        reviews: [],
        isLoading: options?.isLoading ?? false,
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
      },
      chat: {
        messages: [],
        isStreaming: false,
        streamingMessageId: null,
        error: null,
      },
    },
  });

  return render(
    <Provider store={store}>
      <Sidebar />
    </Provider>
  );
}

describe('Sidebar refresh control', () => {
  it('does not render refresh button in demo mode', () => {
    renderSidebar({ demoMode: true, selectedPR: selectedPRFixture });

    expect(screen.queryByTitle('Refresh')).not.toBeInTheDocument();
  });

  it('renders disabled refresh button when no PR is selected', () => {
    renderSidebar({ demoMode: false, selectedPR: null });

    const refreshButton = screen.getByTitle('Refresh');
    expect(refreshButton).toBeDisabled();
  });

  it('renders enabled refresh button when PR is selected and idle', () => {
    renderSidebar({ demoMode: false, selectedPR: selectedPRFixture, isLoading: false });

    const refreshButton = screen.getByTitle('Refresh');
    expect(refreshButton).toBeEnabled();
  });

  it('disables refresh button while loading', () => {
    renderSidebar({ demoMode: false, selectedPR: selectedPRFixture, isLoading: true });

    const refreshButton = screen.getByTitle('Refresh');
    expect(refreshButton).toBeDisabled();
  });
});
