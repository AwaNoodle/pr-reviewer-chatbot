import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { AppConfig } from '../../types';

const STORAGE_KEY = 'pr-review-chatbot-config';

function getDefaultConfig(): AppConfig {
  return {
    githubPat: import.meta.env.VITE_GITHUB_PAT || '',
    llmApiKey: import.meta.env.VITE_LLM_API_KEY || '',
    githubInstance: import.meta.env.VITE_GITHUB_INSTANCE || 'github.com',
    llmBackend: (import.meta.env.VITE_LLM_BACKEND as 'openai' | 'litellm') || 'openai',
    llmEndpoint: import.meta.env.VITE_LLM_ENDPOINT || 'https://api.openai.com/v1',
    llmModel: import.meta.env.VITE_LLM_MODEL || 'gpt-4o',
    demoMode: import.meta.env.VITE_DEMO_MODE === 'true',
  };
}

// Sensitive fields that must NOT be persisted to localStorage.
// They are read from env vars on first load and must be re-entered each session.
const SENSITIVE_FIELDS: ReadonlyArray<keyof AppConfig> = ['githubPat', 'llmApiKey'];

function loadConfigFromStorage(): AppConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<AppConfig>;
      // Never restore sensitive fields from storage — always fall back to env defaults
      SENSITIVE_FIELDS.forEach((key) => delete parsed[key]);
      return { ...getDefaultConfig(), ...parsed };
    }
  } catch {
    // ignore
  }
  return getDefaultConfig();
}

function saveConfigToStorage(config: AppConfig): void {
  try {
    // Strip sensitive fields before writing to localStorage
    const safeConfig = { ...config } as Partial<AppConfig>;
    SENSITIVE_FIELDS.forEach((key) => delete safeConfig[key]);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(safeConfig));
  } catch {
    // ignore
  }
}

interface ConfigState {
  config: AppConfig;
}

const initialState: ConfigState = {
  config: loadConfigFromStorage(),
};

const configSlice = createSlice({
  name: 'config',
  initialState,
  reducers: {
    updateConfig(state, action: PayloadAction<Partial<AppConfig>>) {
      state.config = { ...state.config, ...action.payload };
      saveConfigToStorage(state.config);
    },
    resetConfig(state) {
      state.config = getDefaultConfig();
      saveConfigToStorage(state.config);
    },
    setDemoMode(state, action: PayloadAction<boolean>) {
      state.config.demoMode = action.payload;
      saveConfigToStorage(state.config);
    },
  },
});

export const { updateConfig, resetConfig, setDemoMode } = configSlice.actions;
export default configSlice.reducer;
