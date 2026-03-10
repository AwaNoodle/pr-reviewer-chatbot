import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { createGitHubService, GitHubApiError } from '../../services/github';
import type {
  PullRequest,
  PRFile,
  PRComment,
  PRReviewComment,
  PRReview,
  GitHubApiErrorData,
} from '../../types';
import type { RootState } from '../index';

interface PRRequestArgs {
  owner: string;
  repo: string;
  prNumber: number;
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
  isLoading: boolean;
  error: string | null;
  loadingByResource: {
    metadata: boolean;
    files: boolean;
    comments: boolean;
    reviewComments: boolean;
    reviews: boolean;
  };
  errorByResource: {
    metadata: string | null;
    files: string | null;
    comments: string | null;
    reviewComments: string | null;
    reviews: string | null;
  };
}

const initialState: PRsState = {
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
    null;
}

const prsSlice = createSlice({
  name: 'prs',
  initialState,
  reducers: {
    setSelectedPR(state, action: PayloadAction<PullRequest | null>) {
      state.selectedPR = action.payload;
      // Clear related data when PR changes
      if (!action.payload) {
        state.files = [];
        state.comments = [];
        state.reviewComments = [];
        state.reviews = [];
        state.errorByResource = {
          metadata: null,
          files: null,
          comments: null,
          reviewComments: null,
          reviews: null,
        };
        updateAggregateError(state);
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
    setLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
    },
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
      state.isLoading = false;
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
      });
  },
});

export const {
  setSelectedPR,
  setPRFiles,
  setPRComments,
  setPRReviewComments,
  setPRReviews,
  setLoading,
  setError,
} = prsSlice.actions;

export default prsSlice.reducer;
