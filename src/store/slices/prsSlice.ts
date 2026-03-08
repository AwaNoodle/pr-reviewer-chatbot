import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { PullRequest, PRFile, PRComment, PRReviewComment, PRReview } from '../../types';

interface PRsState {
  selectedPR: PullRequest | null;
  files: PRFile[];
  comments: PRComment[];
  reviewComments: PRReviewComment[];
  reviews: PRReview[];
  isLoading: boolean;
  error: string | null;
}

const initialState: PRsState = {
  selectedPR: null,
  files: [],
  comments: [],
  reviewComments: [],
  reviews: [],
  isLoading: false,
  error: null,
};

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
