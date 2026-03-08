/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const llmEndpoint = env.VITE_LLM_ENDPOINT || 'https://api.openai.com/v1'
  const githubInstance = env.VITE_GITHUB_INSTANCE || 'github.com'
  // VITE_USE_PROXY controls both the LLM and GitHub API proxies.
  // Set to "false" only when a proper reverse proxy is already in place.

  // Build GitHub API base URL for proxy
  const githubApiBase =
    githubInstance === 'github.com' || githubInstance === 'api.github.com'
      ? 'https://api.github.com'
      : `https://${githubInstance}/api/v3`

  return {
    plugins: [react()],
    server: {
      proxy: {
        // Proxy LLM API requests to avoid CORS issues with local LLM servers
        '/api/llm': {
          target: llmEndpoint,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/llm/, ''),
        },
        // Proxy GitHub API requests to avoid CORS issues
        '/api/github': {
          target: githubApiBase,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/github/, ''),
        },
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    },
  }
})
