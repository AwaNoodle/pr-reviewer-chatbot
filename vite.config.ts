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
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) {
              return undefined
            }

            if (
              id.includes('/react/') ||
              id.includes('/react-dom/') ||
              id.includes('/scheduler/')
            ) {
              return 'vendor-react'
            }

            if (
              id.includes('/react-markdown/') ||
              id.includes('/remark-gfm/') ||
              id.includes('/react-syntax-highlighter/') ||
              id.includes('/prismjs/')
            ) {
              return 'vendor-markdown'
            }

            if (
              id.includes('/@reduxjs/') ||
              id.includes('/react-redux/') ||
              id.includes('/axios/') ||
              id.includes('/effect/')
            ) {
              return 'vendor-data'
            }

            if (
              id.includes('/@radix-ui/') ||
              id.includes('/lucide-react/') ||
              id.includes('/tailwind-merge/') ||
              id.includes('/clsx/')
            ) {
              return 'vendor-ui'
            }

            return undefined
          },
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
