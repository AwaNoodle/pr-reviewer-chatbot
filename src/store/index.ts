import { configureStore } from '@reduxjs/toolkit';
import configReducer from './slices/configSlice';
import chatReducer from './slices/chatSlice';
import prsReducer from './slices/prsSlice';
import watchedReposReducer from './slices/watchedReposSlice';

export const store = configureStore({
  reducer: {
    config: configReducer,
    chat: chatReducer,
    prs: prsReducer,
    watchedRepos: watchedReposReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
