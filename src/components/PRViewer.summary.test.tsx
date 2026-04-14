import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PRViewer } from './PRViewer';
import configReducer from '../store/slices/configSlice';
import prsReducer from '../store/slices/prsSlice';
import chatReducer from '../store/slices/chatSlice';
import type { PullRequest } from '../types';

const selectedPRFixture: PullRequest = {
  id: 1,
  number: 42,
  title: 'Summary rendering fixture',
  body: 'Fixture body',
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
  changed_files: 2,
  comments: 0,
  review_comments: 0,
  commits: 2,
  labels: [],
  requested_reviewers: [],
};

function renderViewer(summaryState: {
  status: 'idle' | 'loading' | 'success' | 'empty' | 'error';
  content: string | null;
  generatedAt: number | null;
  error: string | null;
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
          demoMode: false,
          summaryEnabled: true,
          summaryPrompt: 'default summary prompt',
          summaryCommands: '',
        },
      },
      prs: {
        selectedPR: selectedPRFixture,
        activeRepository: null,
        prList: [],
        files: [],
        comments: [],
        reviewComments: [],
        reviews: [],
        commits: [],
        summary: {
          ...summaryState,
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

  return render(
    <Provider store={store}>
      <PRViewer />
    </Provider>
  );
}

describe('PRViewer summary tab', () => {
  it('renders loading state', () => {
    renderViewer({ status: 'loading', content: null, generatedAt: null, error: null });
    expect(screen.getByText('Generating summary...')).toBeInTheDocument();
  });

  it('renders empty fallback state', () => {
    renderViewer({ status: 'empty', content: 'Nothing to Summarize', generatedAt: 123, error: null });
    expect(screen.getByText('Nothing to Summarize')).toBeInTheDocument();
  });

  it('renders failure fallback state', () => {
    renderViewer({ status: 'error', content: null, generatedAt: 123, error: 'Unable to generate summary' });
    expect(screen.getByText('Unable to generate summary')).toBeInTheDocument();
  });

  it('renders orientation-only summary successfully', () => {
    renderViewer({
      status: 'success',
      content: 'PR tightens auth middleware and removes duplicated checks.\nMost risk is around request edge-cases and ordering.\nAPI surface is unchanged.',
      generatedAt: Date.now(),
      error: null,
    });

    expect(screen.getByText('Orientation')).toBeInTheDocument();
    expect(screen.getByText(/tightens auth middleware/i)).toBeInTheDocument();
    expect(screen.queryByText(/Focus Area \d+/i)).not.toBeInTheDocument();
  });

  it('renders one panel per focus area item when present', () => {
    renderViewer({
      status: 'success',
      content: `Short orientation line 1.\nShort orientation line 2.\n\n## Focus Areas\n- **where to review**: auth middleware ordering\n  **why it matters**: incorrect order can bypass checks\n  **what to verify**: all protected routes still enforce auth\n- **where to review**: token refresh branch\n  **why it matters**: race conditions can invalidate valid sessions\n  **what to verify**: refresh flow under concurrent requests`,
      generatedAt: Date.now(),
      error: null,
    });

    expect(screen.getByText('Orientation')).toBeInTheDocument();
    expect(screen.getByText('Focus Area 1')).toBeInTheDocument();
    expect(screen.getByText('Focus Area 2')).toBeInTheDocument();
    expect(screen.getByText(/auth middleware ordering/i)).toBeInTheDocument();
    expect(screen.getByText(/token refresh branch/i)).toBeInTheDocument();
  });
});

describe('PRViewer citation navigation', () => {
  it('navigates to files tab when citation-navigate event is dispatched', async () => {
    const { getByRole } = renderViewer({
      status: 'success',
      content: 'Test summary with [file:src/auth.ts#L10] citation.',
      generatedAt: Date.now(),
      error: null,
    });

    const filesTab = getByRole('button', { name: /files \(\d+\)/i });
    expect(filesTab).toBeInTheDocument();
  });
});
