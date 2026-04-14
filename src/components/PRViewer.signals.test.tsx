import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PRViewer } from './PRViewer';
import configReducer from '../store/slices/configSlice';
import prsReducer from '../store/slices/prsSlice';
import chatReducer from '../store/slices/chatSlice';
import type { PullRequest, PRSignals } from '../types';

const selectedPRFixture: PullRequest = {
  id: 1,
  number: 42,
  title: 'Signals rendering fixture',
  body: 'Fixture body',
  state: 'open',
  merged: false,
  merged_at: null,
  user: { login: 'alice', avatar_url: '', html_url: '' },
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  head: { ref: 'feature', sha: 'abcdef123456', repo: { full_name: 'org/repo' } },
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

function renderViewer(signalsState: {
  status: 'idle' | 'loading' | 'success' | 'error';
  data: PRSignals | null;
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
          status: 'idle' as const,
          content: null,
          generatedAt: null,
          error: null,
          requestKey: null,
          citations: [],
          hasUncitedContent: false,
        },
        signals: {
          ...signalsState,
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

describe('PRViewer signals tab', () => {
  it('renders loading state', async () => {
    const user = userEvent.setup();
    renderViewer({ status: 'loading', data: null, error: null });
    await user.click(screen.getByRole('button', { name: 'Signals' }));
    expect(screen.getByText('Loading CI and scanning signals...')).toBeInTheDocument();
  });

  it('renders unavailable semantics without implying passing', async () => {
    const user = userEvent.setup();
    renderViewer({
      status: 'success',
      data: {
        headSha: 'abcdef123456',
        fetchedAt: Date.now(),
        checks: { sourceState: 'unavailable', total: 0, failing: 0, pending: 0, items: [] },
        statuses: { sourceState: 'error', state: null, statuses: [] },
        scanning: {
          sourceState: 'unavailable',
          openAlerts: 0,
          highSeverityCount: 0,
          severityBuckets: {
            critical: 0,
            high: 0,
            medium: 0,
            low: 0,
            error: 0,
            warning: 0,
            note: 0,
            none: 0,
            unknown: 0,
          },
          items: [],
        },
      },
      error: null,
    });

    await user.click(screen.getByRole('button', { name: 'Signals' }));
    expect(screen.getAllByText(/not confirmed passing/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/all passing/i)).not.toBeInTheDocument();
  });

  it('renders failing check highlights in deterministic order', async () => {
    const user = userEvent.setup();
    const { container } = renderViewer({
      status: 'success',
      data: {
        headSha: 'abcdef123456',
        fetchedAt: Date.now(),
        checks: {
          sourceState: 'ok',
          total: 3,
          failing: 2,
          pending: 0,
          items: [
            { id: 1, name: 'bbb', status: 'completed', conclusion: 'failure' },
            { id: 2, name: 'aaa', status: 'completed', conclusion: 'action_required' },
            { id: 3, name: 'ccc', status: 'completed', conclusion: 'success' },
          ],
        },
        statuses: { sourceState: 'ok-empty', state: null, statuses: [] },
        scanning: {
          sourceState: 'ok-empty',
          openAlerts: 0,
          highSeverityCount: 0,
          severityBuckets: {
            critical: 0,
            high: 0,
            medium: 0,
            low: 0,
            error: 0,
            warning: 0,
            note: 0,
            none: 0,
            unknown: 0,
          },
          items: [],
        },
      },
      error: null,
    });

    await user.click(screen.getByRole('button', { name: 'Signals' }));
    expect(screen.getByText('aaa (action_required)')).toBeInTheDocument();

    const text = container.textContent ?? '';
    expect(text.indexOf('aaa (action_required)')).toBeLessThan(text.indexOf('bbb (failure)'));
  });
});
