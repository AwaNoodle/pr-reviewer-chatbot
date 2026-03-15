import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { createGitHubService, GitHubApiError } from '../../services/github';
import { createLLMService } from '../../services/llm';
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

function toRejectedError(error: unknown): GitHubApiErrorData {
  if (error instanceof GitHubApiError) {
    return error.toJSON();
  }

  return {
    code: 'UNKNOWN_ERROR',
    status: null,
    message: error instanceof Error ? error.message : 'Unexpected GitHub API error',
    userMessage: 'Something went wrong while loading pull request data.',
  };
}

export const fetchPRFiles = createAsyncThunk<
  PRFile[],
  PRRequestArgs,
  { state: RootState; rejectValue: GitHubApiErrorData }
>('prs/fetchPRFiles', async ({ owner, repo, prNumber }, { getState, rejectWithValue }) => {
  const service = createGitHubService(getState().config.config);
  try {
    return await service.getPRFiles(owner, repo, prNumber);
  } catch (error) {
    return rejectWithValue(toRejectedError(error));
  }
});

export const fetchPRComments = createAsyncThunk<
  PRComment[],
  PRRequestArgs,
  { state: RootState; rejectValue: GitHubApiErrorData }
>('prs/fetchPRComments', async ({ owner, repo, prNumber }, { getState, rejectWithValue }) => {
  const service = createGitHubService(getState().config.config);
  try {
    return await service.getPRComments(owner, repo, prNumber);
  } catch (error) {
    return rejectWithValue(toRejectedError(error));
  }
});

export const fetchPRReviewComments = createAsyncThunk<
  PRReviewComment[],
  PRRequestArgs,
  { state: RootState; rejectValue: GitHubApiErrorData }
>('prs/fetchPRReviewComments', async ({ owner, repo, prNumber }, { getState, rejectWithValue }) => {
  const service = createGitHubService(getState().config.config);
  try {
    return await service.getPRReviewComments(owner, repo, prNumber);
  } catch (error) {
    return rejectWithValue(toRejectedError(error));
  }
});

export const fetchPRReviews = createAsyncThunk<
  PRReview[],
  PRRequestArgs,
  { state: RootState; rejectValue: GitHubApiErrorData }
>('prs/fetchPRReviews', async ({ owner, repo, prNumber }, { getState, rejectWithValue }) => {
  const service = createGitHubService(getState().config.config);
  try {
    return await service.getPRReviews(owner, repo, prNumber);
  } catch (error) {
    return rejectWithValue(toRejectedError(error));
  }
});

export const fetchPRCommits = createAsyncThunk<
  PRCommit[],
  PRRequestArgs,
  { state: RootState; rejectValue: GitHubApiErrorData }
>('prs/fetchPRCommits', async ({ owner, repo, prNumber }, { getState, rejectWithValue }) => {
  const service = createGitHubService(getState().config.config);
  try {
    return await service.getPRCommits(owner, repo, prNumber);
  } catch (error) {
    return rejectWithValue(toRejectedError(error));
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

export const fetchPullRequest = createAsyncThunk<
  PullRequest,
  PRRequestArgs,
  { state: RootState; rejectValue: GitHubApiErrorData }
>('prs/fetchPullRequest', async ({ owner, repo, prNumber }, { getState, rejectWithValue }) => {
  const service = createGitHubService(getState().config.config);
  try {
    return await service.getPullRequest(owner, repo, prNumber);
  } catch (error) {
    return rejectWithValue(toRejectedError(error));
  }
});

interface PRsState {
  selectedPR: PullRequest | null;
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
  };
  errorByResource: {
    metadata: string | null;
    files: string | null;
    comments: string | null;
    reviewComments: string | null;
    reviews: string | null;
    commits: string | null;
  };
}

const initialState: PRsState = {
  selectedPR: null,
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
  },
  errorByResource: {
    metadata: null,
    files: null,
    comments: null,
    reviewComments: null,
    reviews: null,
    commits: null,
  },
};

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
        };
        updateAggregateError(state);
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
      .addCase(fetchPullRequest.pending, (state) => {
        state.loadingByResource.metadata = true;
        state.errorByResource.metadata = null;
        updateAggregateLoading(state);
        updateAggregateError(state);
      })
      .addCase(fetchPullRequest.fulfilled, (state, action) => {
        state.selectedPR = action.payload;
        state.loadingByResource.metadata = false;
        updateAggregateLoading(state);
      })
      .addCase(fetchPullRequest.rejected, (state, action) => {
        state.loadingByResource.metadata = false;
        state.errorByResource.metadata = action.payload?.userMessage || action.error.message || 'Failed to load pull request metadata';
        updateAggregateLoading(state);
        updateAggregateError(state);
      })
      .addCase(fetchPRFiles.pending, (state) => {
        state.loadingByResource.files = true;
        state.errorByResource.files = null;
        updateAggregateLoading(state);
        updateAggregateError(state);
      })
      .addCase(fetchPRFiles.fulfilled, (state, action) => {
        state.files = action.payload;
        state.loadingByResource.files = false;
        updateAggregateLoading(state);
      })
      .addCase(fetchPRFiles.rejected, (state, action) => {
        state.loadingByResource.files = false;
        state.errorByResource.files = action.payload?.userMessage || action.error.message || 'Failed to load pull request files';
        updateAggregateLoading(state);
        updateAggregateError(state);
      })
      .addCase(fetchPRComments.pending, (state) => {
        state.loadingByResource.comments = true;
        state.errorByResource.comments = null;
        updateAggregateLoading(state);
        updateAggregateError(state);
      })
      .addCase(fetchPRComments.fulfilled, (state, action) => {
        state.comments = action.payload;
        state.loadingByResource.comments = false;
        updateAggregateLoading(state);
      })
      .addCase(fetchPRComments.rejected, (state, action) => {
        state.loadingByResource.comments = false;
        state.errorByResource.comments = action.payload?.userMessage || action.error.message || 'Failed to load pull request comments';
        updateAggregateLoading(state);
        updateAggregateError(state);
      })
      .addCase(fetchPRReviewComments.pending, (state) => {
        state.loadingByResource.reviewComments = true;
        state.errorByResource.reviewComments = null;
        updateAggregateLoading(state);
        updateAggregateError(state);
      })
      .addCase(fetchPRReviewComments.fulfilled, (state, action) => {
        state.reviewComments = action.payload;
        state.loadingByResource.reviewComments = false;
        updateAggregateLoading(state);
      })
      .addCase(fetchPRReviewComments.rejected, (state, action) => {
        state.loadingByResource.reviewComments = false;
        state.errorByResource.reviewComments = action.payload?.userMessage || action.error.message || 'Failed to load pull request review comments';
        updateAggregateLoading(state);
        updateAggregateError(state);
      })
      .addCase(fetchPRReviews.pending, (state) => {
        state.loadingByResource.reviews = true;
        state.errorByResource.reviews = null;
        updateAggregateLoading(state);
        updateAggregateError(state);
      })
      .addCase(fetchPRReviews.fulfilled, (state, action) => {
        state.reviews = action.payload;
        state.loadingByResource.reviews = false;
        updateAggregateLoading(state);
      })
      .addCase(fetchPRReviews.rejected, (state, action) => {
        state.loadingByResource.reviews = false;
        state.errorByResource.reviews = action.payload?.userMessage || action.error.message || 'Failed to load pull request reviews';
        updateAggregateLoading(state);
        updateAggregateError(state);
      })
      .addCase(fetchPRCommits.pending, (state) => {
        state.loadingByResource.commits = true;
        state.errorByResource.commits = null;
        updateAggregateLoading(state);
        updateAggregateError(state);
      })
      .addCase(fetchPRCommits.fulfilled, (state, action) => {
        state.commits = action.payload;
        state.loadingByResource.commits = false;
        updateAggregateLoading(state);
      })
      .addCase(fetchPRCommits.rejected, (state, action) => {
        state.loadingByResource.commits = false;
        state.errorByResource.commits = action.payload?.userMessage || action.error.message || 'Failed to load pull request commits';
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
  setPRComments,
  setPRReviewComments,
  setPRReviews,
  setPRCommits,
  setLoading,
  setError,
  resetSummaryState,
} = prsSlice.actions;

export default prsSlice.reducer;
