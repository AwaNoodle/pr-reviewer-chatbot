/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GITHUB_PAT: string;
  readonly VITE_LLM_API_KEY: string;
  readonly VITE_GITHUB_INSTANCE: string;
  readonly VITE_LLM_BACKEND: string;
  readonly VITE_LLM_ENDPOINT: string;
  readonly VITE_LLM_MODEL: string;
  readonly VITE_DEMO_MODE: string;
  readonly VITE_LLM_USE_PROXY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
