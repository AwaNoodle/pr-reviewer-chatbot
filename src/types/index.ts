// GitHub Types
export interface GitHubUser {
  login: string;
  avatar_url: string;
  html_url: string;
}

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  private: boolean;
  html_url: string;
  owner: GitHubUser;
  default_branch: string;
}

export interface PullRequest {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  merged: boolean;
  merged_at: string | null;
  user: GitHubUser;
  created_at: string;
  updated_at: string;
  head: {
    ref: string;
    sha: string;
    repo: {
      full_name: string;
    } | null;
  };
  base: {
    ref: string;
    sha: string;
    repo: {
      full_name: string;
    };
  };
  url: string;
  html_url: string;
  diff_url: string;
  additions: number;
  deletions: number;
  changed_files: number;
  comments: number;
  review_comments: number;
  commits: number;
  labels: Array<{
    id: number;
    name: string;
    color: string;
  }>;
  requested_reviewers: GitHubUser[];
}

export interface PRFile {
  sha: string;
  filename: string;
  status: 'added' | 'removed' | 'modified' | 'renamed' | 'copied' | 'changed' | 'unchanged';
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
  contents_url: string;
  previous_filename?: string;
}

export interface PRComment {
  id: number;
  body: string;
  user: GitHubUser;
  created_at: string;
  updated_at: string;
  html_url: string;
}

export interface PRReviewComment extends PRComment {
  path: string;
  position: number | null;
  original_position: number | null;
  diff_hunk: string;
  commit_id: string;
  pull_request_review_id: number | null;
}

export interface PRReview {
  id: number;
  user: GitHubUser;
  body: string | null;
  state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED' | 'PENDING';
  submitted_at: string;
  html_url: string;
}

export type GitHubApiErrorCode =
  | 'AUTHENTICATION_ERROR'
  | 'RATE_LIMITED'
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'VALIDATION_ERROR'
  | 'NETWORK_ERROR'
  | 'UNKNOWN_ERROR';

export interface GitHubApiErrorData {
  code: GitHubApiErrorCode;
  status: number | null;
  message: string;
  userMessage: string;
  documentationUrl?: string;
  retryAfterSeconds?: number;
  rateLimitResetAt?: string;
}

// Chat Types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
  error?: string;
}

// App Config Types
export interface AppConfig {
  githubPat: string;
  llmApiKey: string;
  githubInstance: string;
  llmBackend: 'openai' | 'litellm';
  llmEndpoint: string;
  llmModel: string;
  demoMode: boolean;
}

// LLM Types
export interface LLMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface LLMChatRequest {
  model: string;
  messages: LLMMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
}

export interface LLMChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: LLMMessage;
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface LLMStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
    };
    finish_reason: string | null;
  }>;
}

// PR Context for LLM
export interface PRContext {
  pr: PullRequest;
  files: PRFile[];
  comments: PRComment[];
  reviewComments: PRReviewComment[];
  reviews: PRReview[];
}
