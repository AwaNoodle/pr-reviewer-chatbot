import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { createGitHubService } from '../../services/github';
import { toRejectedErrorData } from '../../effect/errors';
import type { GitHubApiErrorData, WatchedRepository } from '../../types';
import type { RootState } from '../index';

const STORAGE_KEY = 'pr-review-chatbot-watched-repos';

type PersistedWatchedRepo = {
  owner: string;
  repo: string;
};

function loadWatchedRepos(): WatchedRepository[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as PersistedWatchedRepo[];
    return parsed.map((entry) => ({
      owner: entry.owner,
      repo: entry.repo,
      fullName: `${entry.owner}/${entry.repo}`,
      openPRCount: null,
      isLoadingCount: false,
      countError: null,
    }));
  } catch {
    return [];
  }
}

function saveWatchedRepos(items: WatchedRepository[]): void {
  try {
    const data: PersistedWatchedRepo[] = items.map((item) => ({
      owner: item.owner,
      repo: item.repo,
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

export const fetchWatchedRepoPRCount = createAsyncThunk<
  { fullName: string; count: number },
  { owner: string; repo: string },
  { state: RootState; rejectValue: GitHubApiErrorData }
>('watchedRepos/fetchWatchedRepoPRCount', async ({ owner, repo }, { getState, rejectWithValue }) => {
  const service = createGitHubService(getState().config.config);
  const perPage = 100;
  const maxPages = 20;
  let count = 0;

  try {
    for (let page = 1; page <= maxPages; page += 1) {
      const items = await service.listPullRequests(owner, repo, 'open', page, perPage);
      count += items.length;
      if (items.length < perPage) {
        break;
      }
    }

    return {
      fullName: `${owner}/${repo}`,
      count,
    };
  } catch (error) {
    return rejectWithValue(
      toRejectedErrorData(error, 'Something went wrong while loading repository pull request count.')
    );
  }
});

interface WatchedReposState {
  items: WatchedRepository[];
}

const initialState: WatchedReposState = {
  items: loadWatchedRepos(),
};

const watchedReposSlice = createSlice({
  name: 'watchedRepos',
  initialState,
  reducers: {
    addWatchedRepo(state, action: PayloadAction<{ owner: string; repo: string }>) {
      const fullName = `${action.payload.owner}/${action.payload.repo}`;
      if (state.items.some((item) => item.fullName === fullName)) {
        return;
      }

      state.items.push({
        owner: action.payload.owner,
        repo: action.payload.repo,
        fullName,
        openPRCount: null,
        isLoadingCount: false,
        countError: null,
      });
      saveWatchedRepos(state.items);
    },
    removeWatchedRepo(state, action: PayloadAction<string>) {
      state.items = state.items.filter((item) => item.fullName !== action.payload);
      saveWatchedRepos(state.items);
    },
    setWatchedRepoCount(state, action: PayloadAction<{ fullName: string; count: number }>) {
      const repo = state.items.find((item) => item.fullName === action.payload.fullName);
      if (!repo) {
        return;
      }
      repo.openPRCount = action.payload.count;
      repo.countError = null;
      repo.isLoadingCount = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchWatchedRepoPRCount.pending, (state, action) => {
        const fullName = `${action.meta.arg.owner}/${action.meta.arg.repo}`;
        const repo = state.items.find((item) => item.fullName === fullName);
        if (!repo) {
          return;
        }
        repo.isLoadingCount = true;
        repo.countError = null;
      })
      .addCase(fetchWatchedRepoPRCount.fulfilled, (state, action) => {
        const repo = state.items.find((item) => item.fullName === action.payload.fullName);
        if (!repo) {
          return;
        }
        repo.openPRCount = action.payload.count;
        repo.isLoadingCount = false;
        repo.countError = null;
      })
      .addCase(fetchWatchedRepoPRCount.rejected, (state, action) => {
        const fullName = `${action.meta.arg.owner}/${action.meta.arg.repo}`;
        const repo = state.items.find((item) => item.fullName === fullName);
        if (!repo) {
          return;
        }
        repo.isLoadingCount = false;
        repo.countError = action.payload?.userMessage || action.error.message || 'Failed to load open PR count';
      });
  },
});

export const { addWatchedRepo, removeWatchedRepo, setWatchedRepoCount } = watchedReposSlice.actions;

export default watchedReposSlice.reducer;
