# PR Review Chatbot - Agent Instructions

## Project Overview

This is a standalone React + TypeScript webapp that acts as a chatbot interface for reviewing and asking questions about GitHub Pull Requests. It uses an LLM (via OpenAI v1 API or LiteLLM Proxy) to answer questions about PR content.

## Tech Stack

- **Vite** + **React 18** + **TypeScript**
- **Redux Toolkit** for state management
- **Tailwind CSS** for styling
- **Radix UI** for accessible components
- **Axios** for HTTP (GitHub API)
- **react-markdown** + **react-syntax-highlighter** for message rendering

## Project Structure

```
src/
├── App.tsx                    # Root component with layout
├── main.tsx                   # Entry point with Redux Provider
├── index.css                  # Tailwind + CSS variables
├── vite-env.d.ts              # Vite environment type declarations
├── types/
│   └── index.ts               # All TypeScript interfaces
├── store/
│   ├── index.ts               # Redux store configuration
│   ├── hooks.ts               # Typed useAppDispatch / useAppSelector
│   └── slices/
│       ├── configSlice.ts     # App config (env vars + localStorage overrides)
│       ├── chatSlice.ts       # Chat messages + streaming state
│       └── prsSlice.ts        # Selected PR data (files, comments, reviews)
├── services/
│   ├── llm.ts                 # LLM service (OpenAI v1 API + LiteLLM, streaming)
│   ├── github.ts              # GitHub API service (github.com + GHES)
│   └── dummyData.ts           # Sample PR data for demo mode
├── components/
│   ├── App.tsx                # Main layout (sidebar + chat + PR viewer)
│   ├── Sidebar.tsx            # PR navigation + demo mode toggle
│   ├── ChatWindow.tsx         # Chat interface with streaming
│   ├── PRViewer.tsx           # PR details, diffs, comments, reviews
│   └── SettingsDialog.tsx     # Runtime configuration override
└── lib/
    └── utils.ts               # cn(), formatDate(), generateId()
```

## Key Features

### Demo Mode (Default)
- Pre-loaded with a sample JWT authentication PR
- No GitHub credentials required
- Toggle in sidebar or Settings dialog
- Allows immediate LLM interaction

### LLM Integration
- Supports **OpenAI v1 API** and **LiteLLM Proxy** (same API format)
- Streaming responses via Server-Sent Events
- PR context injected as system prompt (PR metadata, diffs, comments, reviews)
- Configurable endpoint, model, and API key

### GitHub Integration
- PAT (Personal Access Token) authentication
- Supports **github.com** and **GitHub Enterprise Server (GHES)**
- GHES base URL: `https://<host>/api/v3`
- Fetches: PR metadata, file diffs, issue comments, review comments, reviews

### Settings
- Runtime override of all configuration
- Persisted to `localStorage`
- Defaults from environment variables (`VITE_*`)

## Environment Variables

```bash
VITE_GITHUB_PAT=          # GitHub Personal Access Token
VITE_LLM_API_KEY=         # LLM API Key
VITE_GITHUB_INSTANCE=github.com  # "github.com" or GHES hostname
VITE_LLM_BACKEND=openai   # "openai" or "litellm"
VITE_LLM_ENDPOINT=https://api.openai.com/v1
VITE_LLM_MODEL=gpt-4o
VITE_DEMO_MODE=true
```

## Development

```bash
npm install       # Install dependencies
npm run dev       # Start dev server (http://localhost:5173)
npm run build     # TypeScript check + production build
npm run preview   # Preview production build
```

## Common Tasks for AI Agents

### Adding a new Redux slice
1. Create `src/store/slices/<name>Slice.ts` following the pattern in existing slices
2. Add the reducer to `src/store/index.ts`
3. Export typed selectors using `useAppSelector`

### Adding a new component
1. Create `src/components/<Name>.tsx`
2. Use `useAppSelector` and `useAppDispatch` from `src/store/hooks.ts`
3. Use `cn()` from `src/lib/utils.ts` for conditional class names
4. Follow Tailwind CSS + CSS variable pattern for theming

### Modifying the LLM system prompt
- Edit `buildSystemPrompt()` in [`src/services/llm.ts`](src/services/llm.ts)
- The method receives a `PRContext` object with `pr`, `files`, `comments`, `reviewComments`, `reviews`

### Adding GitHub API endpoints
- Add methods to the `GitHubService` class in [`src/services/github.ts`](src/services/github.ts)
- The service automatically handles github.com vs GHES URL routing

### Modifying dummy data
- Edit [`src/services/dummyData.ts`](src/services/dummyData.ts)
- The `dummyPRContext` export is used by `ChatWindow` and `Sidebar` in demo mode

## Architecture Notes

### State Flow
```
User types message
  → ChatWindow dispatches addMessage (user)
  → ChatWindow dispatches addMessage (assistant, isStreaming: true)
  → LLMService.chatStream() yields chunks
  → ChatWindow dispatches appendStreamingContent for each chunk
  → ChatWindow dispatches finalizeStreamingMessage when done
```

### Config Priority
```
localStorage override > environment variable > hardcoded default
```

### GHES URL Construction
```typescript
// github.com → https://api.github.com
// mycompany.com → https://mycompany.com/api/v3
```

## Known Limitations / Future Work

- GitHub mode (non-demo) requires manual PR URL entry (not yet implemented in UI)
- No pagination for PR lists
- No OAuth flow (PAT only)
- Context window management (very large PRs may exceed LLM context limits)
- No conversation persistence across page reloads
