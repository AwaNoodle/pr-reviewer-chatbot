import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { PRViewer } from './PRViewer';
import configReducer from '../store/slices/configSlice';
import prsReducer from '../store/slices/prsSlice';
import chatReducer from '../store/slices/chatSlice';
import type { PRFile, PullRequest } from '../types';

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

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: vi.fn(),
  });
});

const filesFixture: PRFile[] = [
  {
    sha: 'file-sha-auth',
    filename: 'src/auth.ts',
    status: 'modified',
    additions: 1,
    deletions: 0,
    changes: 1,
    patch: ['@@ -8,3 +8,4 @@', ' const isValid = true;', ' const user = getUser();', '+const token = getToken();', ' return isValid && !!user;'].join('\n'),
    contents_url: 'https://example.com/auth.ts',
  },
  {
    sha: 'file-sha-orientation',
    filename: 'src/orientation.ts',
    status: 'modified',
    additions: 1,
    deletions: 1,
    changes: 2,
    patch: ['@@ -2,2 +2,2 @@', '-const oldValue = true;', '+const newValue = true;'].join('\n'),
    contents_url: 'https://example.com/orientation.ts',
  },
  {
    sha: 'file-sha-payments',
    filename: 'src/payments.ts',
    status: 'modified',
    additions: 1,
    deletions: 1,
    changes: 2,
    patch: ['@@ -44,2 +44,2 @@', '-const previousTotal = 0;', '+const currentTotal = 1;'].join('\n'),
    contents_url: 'https://example.com/payments.ts',
  },
];

const cite = (target: string) => `[${['file', target].join(':')}]`;

function renderViewer(
  summaryState: {
  status: 'idle' | 'loading' | 'success' | 'empty' | 'error';
  content: string | null;
  generatedAt: number | null;
  error: string | null;
},
  options?: {
    files?: PRFile[];
  }
) {
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
        files: options?.files ?? [],
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

  const renderResult = render(
    <Provider store={store}>
      <PRViewer />
    </Provider>
  );

  return { ...renderResult, store };
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
  it('navigates to files tab and preserves line focus for line citations', async () => {
    renderViewer({
      status: 'success',
      content: `Test summary with ${cite('src/auth.ts#L10')} citation.`,
      generatedAt: Date.now(),
      error: null,
    }, { files: filesFixture });

    fireEvent.click(screen.getByRole('button', { name: 'src/auth.ts#10' }));

    await waitFor(() => {
      expect(screen.getByText('+const token = getToken();')).toBeInTheDocument();
    });

    const focusedLine = screen.getByText('+const token = getToken();');
    expect(focusedLine).toHaveClass('ring-yellow-400');
  });

  it('navigates to files tab and leaves line unset for file citations', async () => {
    const { store } = renderViewer({
      status: 'success',
      content: `Test summary with ${cite('src/auth.ts')} citation.`,
      generatedAt: Date.now(),
      error: null,
    }, { files: filesFixture });

    fireEvent.click(screen.getByRole('button', { name: 'src/auth.ts' }));

    await waitFor(() => {
      expect(store.getState().prs.focusedFileIndex).toBe(0);
    });

    expect(store.getState().prs.focusedFileLine).toBeNull();
  });

  it('keeps orientation and focus-area citations scoped to their own panel', () => {
    renderViewer({
      status: 'success',
      content: [
        `Orientation line with citation ${cite('src/orientation.ts#L3')}.`,
        '',
        '## Focus Areas',
        `- **where to review**: auth paths ${cite('src/auth.ts#L10')}`,
        '  **why it matters**: token handling correctness',
        '  **what to verify**: invalid token rejection',
        `- **where to review**: payment totals ${cite('src/payments.ts#L44')}`,
        '  **why it matters**: totals can drift',
        '  **what to verify**: total remains deterministic',
      ].join('\n'),
      generatedAt: Date.now(),
      error: null,
    }, { files: filesFixture });

    const orientationPanel = screen.getByText('Orientation').parentElement;
    const focusAreaOnePanel = screen.getByText('Focus Area 1').parentElement;
    const focusAreaTwoPanel = screen.getByText('Focus Area 2').parentElement;

    expect(orientationPanel).not.toBeNull();
    expect(focusAreaOnePanel).not.toBeNull();
    expect(focusAreaTwoPanel).not.toBeNull();

    expect(within(orientationPanel as HTMLElement).getByRole('button', { name: 'src/orientation.ts#3' })).toBeInTheDocument();
    expect(within(orientationPanel as HTMLElement).queryByRole('button', { name: 'src/auth.ts#10' })).not.toBeInTheDocument();
    expect(within(orientationPanel as HTMLElement).queryByRole('button', { name: 'src/payments.ts#44' })).not.toBeInTheDocument();

    expect(within(focusAreaOnePanel as HTMLElement).getByRole('button', { name: 'src/auth.ts#10' })).toBeInTheDocument();
    expect(within(focusAreaOnePanel as HTMLElement).queryByRole('button', { name: 'src/orientation.ts#3' })).not.toBeInTheDocument();
    expect(within(focusAreaOnePanel as HTMLElement).queryByRole('button', { name: 'src/payments.ts#44' })).not.toBeInTheDocument();

    expect(within(focusAreaTwoPanel as HTMLElement).getByRole('button', { name: 'src/payments.ts#44' })).toBeInTheDocument();
    expect(within(focusAreaTwoPanel as HTMLElement).queryByRole('button', { name: 'src/orientation.ts#3' })).not.toBeInTheDocument();
    expect(within(focusAreaTwoPanel as HTMLElement).queryByRole('button', { name: 'src/auth.ts#10' })).not.toBeInTheDocument();
  });

  it('navigates to files tab when citation-navigate event is dispatched', async () => {
    const { getByRole } = renderViewer({
      status: 'success',
      content: `Test summary with ${cite('src/auth.ts#L10')} citation.`,
      generatedAt: Date.now(),
      error: null,
    }, { files: filesFixture });

    const filesTab = getByRole('button', { name: /files \(\d+\)/i });
    expect(filesTab).toBeInTheDocument();
  });
});
