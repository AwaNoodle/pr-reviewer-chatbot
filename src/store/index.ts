import { configureStore } from '@reduxjs/toolkit';
import configReducer from './slices/configSlice';
import chatReducer from './slices/chatSlice';
import prsReducer from './slices/prsSlice';

export const store = configureStore({
  reducer: {
    config: configReducer,
    chat: chatReducer,
    prs: prsReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
