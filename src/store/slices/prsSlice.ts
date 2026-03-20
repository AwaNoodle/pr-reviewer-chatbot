import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { createGitHubService } from '../../services/github';
import { createLLMService } from '../../services/llm';
import { runEffect } from '../../effect/runtime';
import { loadPullRequestContext } from '../../effect/loadPullRequestContext';
import { toRejectedErrorData } from '../../effect/errors';
import {
  buildSummaryCacheKey,
  buildSummaryRateLimitKey,
  canGenerateSummary,
  hasTextualDiffContent,
  markSummaryGenerated,
  readSummaryCache,
  writeSummaryCache,
} from '../../services/summary';
import type {
  PullRequest,
  PRListItem,
  PRFile,
  PRComment,
  PRReviewComment,
  PRReview,
  PRCommit,
  GitHubApiErrorData,
} from '../../types';
import type { RootState } from '../index';

interface PRRequestArgs {
  owner: string;
  repo: string;
  prNumber: number;
}

interface RepoRequestArgs {
  owner: string;
  repo: string;
}

type PRResourceKey = 'metadata' | 'files' | 'comments' | 'reviewComments' | 'reviews' | 'commits';

type SummaryStatus = 'idle' | 'loading' | 'success' | 'empty' | 'error';

interface SummaryState {
  status: SummaryStatus;
  content: string | null;
  generatedAt: number | null;
  error: string | null;
  requestKey: string | null;
}

interface SummaryResult {
  status: 'success' | 'empty' | 'error';
  content: string | null;
  generatedAt: number;
  error: string | null;
  requestKey: string;
}

interface PullRequestContextPayload {
  pullRequest: PullRequest;
  files: PRFile[];
  comments: PRComment[];
  reviewComments: PRReviewComment[];
  reviews: PRReview[];
  commits: PRCommit[];
}

export const fetchRepositoryPRList = createAsyncThunk<
  PRListItem[],
  RepoRequestArgs,
  { state: RootState; rejectValue: GitHubApiErrorData }
>('prs/fetchRepositoryPRList', async ({ owner, repo }, { getState, rejectWithValue }) => {
  const service = createGitHubService(getState().config.config);
  const perPage = 100;
  const maxPages = 20;
  const prs: PullRequest[] = [];

  try {
    for (let page = 1; page <= maxPages; page += 1) {
      const pagePRs = await service.listPullRequests(owner, repo, 'open', page, perPage);
      prs.push(...pagePRs);

      if (pagePRs.length < perPage) {
        break;
      }
    }

    return prs.map((pr) => ({
      id: pr.id,
      number: pr.number,
      title: pr.title,
      state: pr.state,
      merged: pr.merged,
      user: pr.user,
      updated_at: pr.updated_at,
      base: pr.base,
      head: pr.head,
    }));
  } catch (error) {
    return rejectWithValue(toRejectedErrorData(error));
  }
});

export const generatePRSummary = createAsyncThunk<
  SummaryResult,
  PRRequestArgs,
  { state: RootState; rejectValue: SummaryResult }
>('prs/generatePRSummary', async ({ owner, repo, prNumber }, { getState, rejectWithValue, requestId }) => {
  const state = getState();
  const { selectedPR, files, comments, reviewComments, reviews, commits } = state.prs;
  const { config } = state.config;

  const requestKey = `${owner}/${repo}#${prNumber}@${selectedPR?.head.sha ?? 'unknown'}:${requestId}`;
  const generatedAt = Date.now();

  if (!config.summaryEnabled || !selectedPR) {
    return rejectWithValue({
      status: 'error',
      content: null,
      generatedAt,
      error: 'Summary generation is disabled.',
      requestKey,
    });
  }

  const headSha = selectedPR.head.sha;
  const cacheKey = buildSummaryCacheKey({
    owner,
    repo,
    prNumber,
    headSha,
    summaryPrompt: config.summaryPrompt,
    summaryCommands: config.summaryCommands,
  });
  const rateLimitKey = buildSummaryRateLimitKey(owner, repo, prNumber, headSha);

  const cachedSummary = readSummaryCache(cacheKey);
  if (cachedSummary) {
    return {
      status: 'success',
      content: cachedSummary.content,
      generatedAt: cachedSummary.generatedAt,
      error: null,
      requestKey,
    };
  }

  if (!hasTextualDiffContent(files)) {
    return {
      status: 'empty',
      content: 'Nothing to Summarize',
      generatedAt,
      error: null,
      requestKey,
    };
  }

  if (!canGenerateSummary(rateLimitKey, generatedAt)) {
    return rejectWithValue({
      status: 'error',
      content: null,
      generatedAt,
      error: 'Summary was generated less than a minute ago. Please wait before retrying.',
      requestKey,
    });
  }

  try {
    const llmService = createLLMService(config);
    const summarySystemPrompt = llmService.buildSummaryPrompt(
      {
        pr: selectedPR,
        files,
        comments,
        reviewComments,
        reviews,
        commits,
      },
      config.summaryPrompt,
      config.summaryCommands
    );

    const summaryContent = await llmService.chat([
      { role: 'system', content: summarySystemPrompt },
      { role: 'user', content: 'Generate the pull request review summary now.' },
    ]);

    markSummaryGenerated(rateLimitKey, generatedAt);
    writeSummaryCache(cacheKey, {
      content: summaryContent,
      generatedAt,
    });

    return {
      status: 'success',
      content: summaryContent,
      generatedAt,
      error: null,
      requestKey,
    };
  } catch (error) {
    return rejectWithValue({
      status: 'error',
      content: null,
      generatedAt,
      error: error instanceof Error ? error.message : 'Unable to generate summary',
      requestKey,
    });
  }
});

export const fetchPullRequestContext = createAsyncThunk<
  PullRequestContextPayload,
  PRRequestArgs,
  { state: RootState; rejectValue: GitHubApiErrorData }
>('prs/fetchPullRequestContext', async ({ owner, repo, prNumber }, { getState, rejectWithValue }) => {
  const service = createGitHubService(getState().config.config);

  try {
    return await runEffect(
      loadPullRequestContext(service, {
        owner,
        repo,
        prNumber,
      })
    );
  } catch (error) {
    return rejectWithValue(toRejectedErrorData(error));
  }
});

interface PRsState {
  selectedPR: PullRequest | null;
  activeRepository: { owner: string; repo: string } | null;
  prList: PRListItem[];
  files: PRFile[];
  comments: PRComment[];
  reviewComments: PRReviewComment[];
  reviews: PRReview[];
  commits: PRCommit[];
  summary: SummaryState;
  isLoading: boolean;
  error: string | null;
  loadingByResource: {
    metadata: boolean;
    files: boolean;
    comments: boolean;
    reviewComments: boolean;
    reviews: boolean;
    commits: boolean;
    prList: boolean;
  };
  errorByResource: {
    metadata: string | null;
    files: string | null;
    comments: string | null;
    reviewComments: string | null;
    reviews: string | null;
    commits: string | null;
    prList: string | null;
  };
  latestRequestKeyByResource: Record<PRResourceKey, string | null>;
}

const initialState: PRsState = {
  selectedPR: null,
  activeRepository: null,
  prList: [],
  files: [],
  comments: [],
  reviewComments: [],
  reviews: [],
  commits: [],
  summary: {
    status: 'idle',
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

function getPRRequestKey(args: PRRequestArgs): string {
  return `${args.owner}/${args.repo}#${args.prNumber}`;
}

function updateAggregateLoading(state: PRsState): void {
  state.isLoading = Object.values(state.loadingByResource).some(Boolean);
}

function updateAggregateError(state: PRsState): void {
  state.error =
    state.errorByResource.metadata ||
    state.errorByResource.files ||
    state.errorByResource.comments ||
    state.errorByResource.reviewComments ||
    state.errorByResource.reviews ||
    state.errorByResource.commits ||
    state.errorByResource.prList ||
    null;
}

const prsSlice = createSlice({
  name: 'prs',
  initialState,
  reducers: {
    setSelectedPR(state, action: PayloadAction<PullRequest | null>) {
      const previousPRId = state.selectedPR?.id ?? null;
      state.selectedPR = action.payload;
      // Clear related data when PR changes
      if (!action.payload) {
        state.files = [];
        state.comments = [];
        state.reviewComments = [];
        state.reviews = [];
        state.commits = [];
        state.summary = {
          status: 'idle',
          content: null,
          generatedAt: null,
          error: null,
          requestKey: null,
        };
        state.errorByResource = {
          metadata: null,
          files: null,
          comments: null,
          reviewComments: null,
          reviews: null,
          commits: null,
          prList: null,
        };
        updateAggregateError(state);
        state.latestRequestKeyByResource = {
          metadata: null,
          files: null,
          comments: null,
          reviewComments: null,
          reviews: null,
          commits: null,
        };
      } else if (previousPRId !== action.payload.id) {
        state.commits = [];
        state.summary = {
          status: 'idle',
          content: null,
          generatedAt: null,
          error: null,
          requestKey: null,
        };
      }
    },
    setPRFiles(state, action: PayloadAction<PRFile[]>) {
      state.files = action.payload;
    },
    setPRList(state, action: PayloadAction<PRListItem[]>) {
      state.prList = action.payload;
    },
    setActiveRepository(state, action: PayloadAction<{ owner: string; repo: string } | null>) {
      state.activeRepository = action.payload;
    },
    setPRComments(state, action: PayloadAction<PRComment[]>) {
      state.comments = action.payload;
    },
    setPRReviewComments(state, action: PayloadAction<PRReviewComment[]>) {
      state.reviewComments = action.payload;
    },
    setPRReviews(state, action: PayloadAction<PRReview[]>) {
      state.reviews = action.payload;
    },
    setPRCommits(state, action: PayloadAction<PRCommit[]>) {
      state.commits = action.payload;
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
    },
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
      state.isLoading = false;
    },
    resetSummaryState(state) {
      state.summary = {
        status: 'idle',
        content: null,
        generatedAt: null,
        error: null,
        requestKey: null,
      };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPullRequestContext.pending, (state, action) => {
        const requestKey = getPRRequestKey(action.meta.arg);
        state.latestRequestKeyByResource.metadata = requestKey;
        state.latestRequestKeyByResource.files = requestKey;
        state.latestRequestKeyByResource.comments = requestKey;
        state.latestRequestKeyByResource.reviewComments = requestKey;
        state.latestRequestKeyByResource.reviews = requestKey;
        state.latestRequestKeyByResource.commits = requestKey;

        state.loadingByResource.metadata = true;
        state.loadingByResource.files = true;
        state.loadingByResource.comments = true;
        state.loadingByResource.reviewComments = true;
        state.loadingByResource.reviews = true;
        state.loadingByResource.commits = true;

        state.errorByResource.metadata = null;
        state.errorByResource.files = null;
        state.errorByResource.comments = null;
        state.errorByResource.reviewComments = null;
        state.errorByResource.reviews = null;
        state.errorByResource.commits = null;

        updateAggregateLoading(state);
        updateAggregateError(state);
      })
      .addCase(fetchPullRequestContext.fulfilled, (state, action) => {
        if (state.latestRequestKeyByResource.metadata !== getPRRequestKey(action.meta.arg)) {
          return;
        }

        state.selectedPR = action.payload.pullRequest;
        state.files = action.payload.files;
        state.comments = action.payload.comments;
        state.reviewComments = action.payload.reviewComments;
        state.reviews = action.payload.reviews;
        state.commits = action.payload.commits;

        state.loadingByResource.metadata = false;
        state.loadingByResource.files = false;
        state.loadingByResource.comments = false;
        state.loadingByResource.reviewComments = false;
        state.loadingByResource.reviews = false;
        state.loadingByResource.commits = false;

        updateAggregateLoading(state);
      })
      .addCase(fetchPullRequestContext.rejected, (state, action) => {
        if (state.latestRequestKeyByResource.metadata !== getPRRequestKey(action.meta.arg)) {
          return;
        }

        const message =
          action.payload?.userMessage || action.error.message || 'Failed to load pull request context';

        state.loadingByResource.metadata = false;
        state.loadingByResource.files = false;
        state.loadingByResource.comments = false;
        state.loadingByResource.reviewComments = false;
        state.loadingByResource.reviews = false;
        state.loadingByResource.commits = false;

        state.errorByResource.metadata = message;
        state.errorByResource.files = message;
        state.errorByResource.comments = message;
        state.errorByResource.reviewComments = message;
        state.errorByResource.reviews = message;
        state.errorByResource.commits = message;

        updateAggregateLoading(state);
        updateAggregateError(state);
      })
      .addCase(fetchRepositoryPRList.pending, (state) => {
        state.loadingByResource.prList = true;
        state.errorByResource.prList = null;
        updateAggregateLoading(state);
        updateAggregateError(state);
      })
      .addCase(fetchRepositoryPRList.fulfilled, (state, action) => {
        state.prList = action.payload;
        state.loadingByResource.prList = false;
        updateAggregateLoading(state);
      })
      .addCase(fetchRepositoryPRList.rejected, (state, action) => {
        state.loadingByResource.prList = false;
        state.errorByResource.prList = action.payload?.userMessage || action.error.message || 'Failed to load repository pull requests';
        updateAggregateLoading(state);
        updateAggregateError(state);
      })
      .addCase(generatePRSummary.pending, (state, action) => {
        state.summary.status = 'loading';
        state.summary.error = null;
        state.summary.requestKey = action.meta.requestId;
      })
      .addCase(generatePRSummary.fulfilled, (state, action) => {
        if (state.summary.requestKey !== action.meta.requestId) {
          return;
        }

        state.summary.status = action.payload.status;
        state.summary.content = action.payload.content;
        state.summary.generatedAt = action.payload.generatedAt;
        state.summary.error = action.payload.error;
      })
      .addCase(generatePRSummary.rejected, (state, action) => {
        if (state.summary.requestKey !== action.meta.requestId) {
          return;
        }

        state.summary.status = 'error';
        state.summary.content = null;
        state.summary.generatedAt = action.payload?.generatedAt ?? Date.now();
        state.summary.error = action.payload?.error || action.error.message || 'Unable to generate summary';
      });
  },
});

export const {
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
} = prsSlice.actions;

export default prsSlice.reducer;
