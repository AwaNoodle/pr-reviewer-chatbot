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

export interface PRCommit {
  sha: string;
  commit: {
    message: string;
  };
  html_url: string;
}

export interface WatchedRepository {
  owner: string;
  repo: string;
  fullName: string;
  openPRCount: number | null;
  isLoadingCount: boolean;
  countError: string | null;
}

export interface PRListItem {
  id: number;
  number: number;
  title: string;
  state: 'open' | 'closed';
  merged: boolean;
  user: GitHubUser;
  updated_at: string;
  base: PullRequest['base'];
  head: PullRequest['head'];
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
  citations?: DiffCitation[];
  hasUncitedContent?: boolean;
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
  summaryEnabled: boolean;
  summaryPrompt: string;
  summaryCommands: string;
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

// Signal types
export type SignalSourceState = 'ok' | 'ok-empty' | 'unavailable' | 'error';
export type SignalLoadStatus = 'idle' | 'loading' | 'success' | 'error';

export type CheckRunStatus = 'queued' | 'in_progress' | 'completed' | 'waiting';

export interface NormalizedCheckRun {
  id: number;
  name: string;
  status: CheckRunStatus;
  conclusion: string | null;
}

export interface CheckSignals {
  sourceState: SignalSourceState;
  total: number;
  failing: number;
  pending: number;
  items: NormalizedCheckRun[];
}

export interface NormalizedCommitStatus {
  context: string;
  state: 'pending' | 'success' | 'failure' | 'error';
  description: string | null;
}

export interface StatusSignals {
  sourceState: SignalSourceState;
  state: 'pending' | 'success' | 'failure' | 'error' | null;
  statuses: NormalizedCommitStatus[];
}

export type CodeScanningSeverity =
  | 'critical'
  | 'high'
  | 'medium'
  | 'low'
  | 'error'
  | 'warning'
  | 'note'
  | 'none'
  | 'unknown';

export interface NormalizedScanningAlert {
  number: number;
  ruleId: string;
  severity: CodeScanningSeverity;
  state: 'open' | 'dismissed' | 'fixed';
  location: string;
}

export interface ScanningSignals {
  sourceState: SignalSourceState;
  openAlerts: number;
  highSeverityCount: number;
  severityBuckets: Record<CodeScanningSeverity, number>;
  items: NormalizedScanningAlert[];
}

export interface PRSignals {
  checks: CheckSignals;
  statuses: StatusSignals;
  scanning: ScanningSignals;
  fetchedAt: number;
  headSha: string;
}

// Citation Types
export interface DiffCitation {
  file: string;
  lineStart?: number;
  lineEnd?: number;
  snippet?: string;
}

export interface AssistantClaim {
  id: string;
  text: string;
  citations: DiffCitation[];
  confidence: 'high' | 'medium' | 'low' | 'uncited';
}

export interface CitationParseResult {
  claims: AssistantClaim[];
  uncitedText: string[];
  parseErrors: string[];
}

export interface ResolvedCitation {
  citation: DiffCitation;
  resolved: boolean;
  fileIndex: number | null;
  lineAnchor: number | null;
  reason?: string;
}

// PR Context for LLM
export interface PRContext {
  pr: PullRequest;
  files: PRFile[];
  comments: PRComment[];
  reviewComments: PRReviewComment[];
  reviews: PRReview[];
  commits?: PRCommit[];
}
