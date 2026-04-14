import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios';
import type {
  GitHubRepository,
  PullRequest,
  PRFile,
  PRComment,
  PRReviewComment,
  PRReview,
  PRCommit,
  AppConfig,
  GitHubApiErrorCode,
  GitHubApiErrorData,
  CheckSignals,
  StatusSignals,
  ScanningSignals,
  NormalizedCheckRun,
  NormalizedCommitStatus,
  NormalizedScanningAlert,
  CheckRunStatus,
  CodeScanningSeverity,
} from '../types';

type GitHubErrorResponse = {
  message?: string;
  documentation_url?: string;
};

export class GitHubApiError extends Error {
  readonly code: GitHubApiErrorCode;
  readonly status: number | null;
  readonly userMessage: string;
  readonly documentationUrl?: string;
  readonly retryAfterSeconds?: number;
  readonly rateLimitResetAt?: string;

  constructor(data: GitHubApiErrorData) {
    super(data.message);
    this.name = 'GitHubApiError';
    this.code = data.code;
    this.status = data.status;
    this.userMessage = data.userMessage;
    this.documentationUrl = data.documentationUrl;
    this.retryAfterSeconds = data.retryAfterSeconds;
    this.rateLimitResetAt = data.rateLimitResetAt;
  }

  toJSON(): GitHubApiErrorData {
    return {
      code: this.code,
      status: this.status,
      message: this.message,
      userMessage: this.userMessage,
      documentationUrl: this.documentationUrl,
      retryAfterSeconds: this.retryAfterSeconds,
      rateLimitResetAt: this.rateLimitResetAt,
    };
  }
}

export function parseGitHubError(error: unknown): GitHubApiError {
  if (!axios.isAxiosError(error)) {
    return new GitHubApiError({
      code: 'UNKNOWN_ERROR',
      status: null,
      message: error instanceof Error ? error.message : 'Unexpected GitHub API error',
      userMessage: 'Something went wrong while talking to GitHub. Please try again.',
    });
  }

  if (!error.response) {
    return new GitHubApiError({
      code: 'NETWORK_ERROR',
      status: null,
      message: error.message,
      userMessage:
        'Unable to reach GitHub. Check your network connection and GitHub instance setting.',
    });
  }

  const status = error.response.status;
  const responseData = error.response.data as GitHubErrorResponse | undefined;
  const message = responseData?.message || error.message;
  const documentationUrl = responseData?.documentation_url;

  if (status === 401) {
    return new GitHubApiError({
      code: 'AUTHENTICATION_ERROR',
      status,
      message,
      userMessage: 'GitHub authentication failed. Update your Personal Access Token in Settings.',
      documentationUrl,
    });
  }

  const rateLimitRemaining = error.response.headers['x-ratelimit-remaining'];
  const rateLimitReset = error.response.headers['x-ratelimit-reset'];
  const retryAfter = error.response.headers['retry-after'];
  const isRateLimited =
    status === 429 ||
    (status === 403 && rateLimitRemaining === '0') ||
    (status === 403 && message.toLowerCase().includes('rate limit'));

  if (isRateLimited) {
    const resetEpoch = Number(rateLimitReset);
    const rateLimitResetAt = Number.isFinite(resetEpoch)
      ? new Date(resetEpoch * 1000).toISOString()
      : undefined;
    const retryAfterSeconds = retryAfter ? Number(retryAfter) : undefined;

    return new GitHubApiError({
      code: 'RATE_LIMITED',
      status,
      message,
      userMessage:
        'GitHub rate limit reached. Wait a bit before retrying, or use an authenticated token.',
      documentationUrl,
      retryAfterSeconds: Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : undefined,
      rateLimitResetAt,
    });
  }

  if (status === 404) {
    return new GitHubApiError({
      code: 'NOT_FOUND',
      status,
      message,
      userMessage: 'The requested GitHub resource was not found. Check owner, repo, and PR number.',
      documentationUrl,
    });
  }

  if (status === 403) {
    return new GitHubApiError({
      code: 'FORBIDDEN',
      status,
      message,
      userMessage: 'Access to this GitHub resource is forbidden. Confirm token scopes and permissions.',
      documentationUrl,
    });
  }

  if (status === 422) {
    return new GitHubApiError({
      code: 'VALIDATION_ERROR',
      status,
      message,
      userMessage: 'GitHub rejected this request. Check that the request parameters are valid.',
      documentationUrl,
    });
  }

  return new GitHubApiError({
    code: 'UNKNOWN_ERROR',
    status,
    message,
    userMessage: 'GitHub request failed. Please retry in a moment.',
    documentationUrl,
  });
}

// ---------------------------------------------------------------------------
// GitHub signal normalization helpers
// ---------------------------------------------------------------------------

function normalizeCheckRunStatus(status: string): CheckRunStatus {
  switch (status) {
    case 'completed': return 'completed';
    case 'in_progress': return 'in_progress';
    case 'waiting': return 'waiting';
    default: return 'queued';
  }
}

function isCheckRunFailing(run: NormalizedCheckRun): boolean {
  return (
    run.status === 'completed' &&
    ['failure', 'timed_out', 'action_required', 'cancelled'].includes(run.conclusion ?? '')
  );
}

function isCheckRunPending(run: NormalizedCheckRun): boolean {
  return run.status !== 'completed';
}

function normalizeCommitStatusState(
  state: string
): 'pending' | 'success' | 'failure' | 'error' {
  switch (state) {
    case 'pending': return 'pending';
    case 'success': return 'success';
    case 'failure': return 'failure';
    default: return 'error';
  }
}

function normalizeCodeScanningSeverity(severity: string | null): CodeScanningSeverity {
  switch (severity) {
    case 'critical': return 'critical';
    case 'high': return 'high';
    case 'medium': return 'medium';
    case 'low': return 'low';
    case 'error': return 'error';
    case 'warning': return 'warning';
    case 'note': return 'note';
    case 'none': return 'none';
    default: return 'unknown';
  }
}

function normalizeAlertState(state: string): 'open' | 'dismissed' | 'fixed' {
  switch (state) {
    case 'dismissed': return 'dismissed';
    case 'fixed': return 'fixed';
    default: return 'open';
  }
}

export class GitHubService {
  private client: AxiosInstance;
  private config: AppConfig;

  constructor(config: AppConfig) {
    this.config = config;
    const baseURL = this.getBaseURL();

    this.client = axios.create({
      baseURL,
      headers: {
        Accept: 'application/vnd.github.v3+json',
        ...(config.githubPat
          ? { Authorization: `Bearer ${config.githubPat}` }
          : {}),
      },
    });
  }

  private getBaseURL(): string {
    // Use the Vite dev proxy path to avoid CORS issues when calling the GitHub
    // API from the browser. The proxy is configured in vite.config.ts and
    // rewrites /api/github → <githubApiBase>.
    // Set VITE_LLM_USE_PROXY=false to bypass the proxy (e.g. in production
    // when a proper reverse proxy is already in place).
    const useProxy = import.meta.env.VITE_USE_PROXY !== 'false';
    if (useProxy) {
      return '/api/github';
    }
    return this.buildDirectBaseURL(this.config.githubInstance);
  }

  private buildDirectBaseURL(instance: string): string {
    // Remove protocol if present
    const host = instance.replace(/^https?:\/\//, '');

    if (host === 'github.com' || host === 'api.github.com') {
      return 'https://api.github.com';
    }

    // GHES: https://<host>/api/v3
    return `https://${host}/api/v3`;
  }

  private async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    try {
      const response = await this.client.get<T>(url, config);
      return response.data;
    } catch (error) {
      throw parseGitHubError(error);
    }
  }

  async listRepositories(page = 1, perPage = 30): Promise<GitHubRepository[]> {
    return this.get<GitHubRepository[]>('/user/repos', {
      params: {
        sort: 'updated',
        per_page: perPage,
        page,
      },
    });
  }

  async searchRepositories(query: string, page = 1): Promise<GitHubRepository[]> {
    const data = await this.get<{ items: GitHubRepository[] }>(
      '/search/repositories',
      {
        params: {
          q: query,
          sort: 'updated',
          per_page: 20,
          page,
        },
      }
    );
    return data.items;
  }

  async listPullRequests(
    owner: string,
    repo: string,
    state: 'open' | 'closed' | 'all' = 'open',
    page = 1,
    perPage = 30
  ): Promise<PullRequest[]> {
    return this.get<PullRequest[]>(
      `/repos/${owner}/${repo}/pulls`,
      {
        params: {
          state,
          sort: 'updated',
          direction: 'desc',
          per_page: perPage,
          page,
        },
      }
    );
  }

  async getPullRequest(owner: string, repo: string, prNumber: number): Promise<PullRequest> {
    return this.get<PullRequest>(
      `/repos/${owner}/${repo}/pulls/${prNumber}`
    );
  }

  async getPRFiles(owner: string, repo: string, prNumber: number): Promise<PRFile[]> {
    const perPage = 100;
    const maxPages = 20;
    const files: PRFile[] = [];

    for (let page = 1; page <= maxPages; page += 1) {
      const pageFiles = await this.get<PRFile[]>(
        `/repos/${owner}/${repo}/pulls/${prNumber}/files`,
        {
          params: {
            per_page: perPage,
            page,
          },
        }
      );

      files.push(...pageFiles);

      if (pageFiles.length < perPage) {
        return files;
      }
    }

    throw new GitHubApiError({
      code: 'UNKNOWN_ERROR',
      status: null,
      message: 'Exceeded maximum pagination depth while fetching pull request files',
      userMessage:
        'Could not load all pull request files because the result set is unusually large. Please narrow scope and retry.',
    });
  }

  async getPRComments(owner: string, repo: string, prNumber: number): Promise<PRComment[]> {
    return this.get<PRComment[]>(
      `/repos/${owner}/${repo}/issues/${prNumber}/comments`,
      {
        params: { per_page: 100 },
      }
    );
  }

  async getPRReviewComments(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<PRReviewComment[]> {
    return this.get<PRReviewComment[]>(
      `/repos/${owner}/${repo}/pulls/${prNumber}/comments`,
      {
        params: { per_page: 100 },
      }
    );
  }

  async getPRReviews(owner: string, repo: string, prNumber: number): Promise<PRReview[]> {
    return this.get<PRReview[]>(
      `/repos/${owner}/${repo}/pulls/${prNumber}/reviews`
    );
  }

  async getPRCommits(owner: string, repo: string, prNumber: number): Promise<PRCommit[]> {
    const perPage = 100;
    const maxPages = 10;
    const commits: PRCommit[] = [];

    for (let page = 1; page <= maxPages; page += 1) {
      const pageCommits = await this.get<PRCommit[]>(
        `/repos/${owner}/${repo}/pulls/${prNumber}/commits`,
        {
          params: {
            per_page: perPage,
            page,
          },
        }
      );

      commits.push(...pageCommits);

      if (pageCommits.length < perPage) {
        return commits;
      }
    }

    throw new GitHubApiError({
      code: 'UNKNOWN_ERROR',
      status: null,
      message: 'Exceeded maximum pagination depth while fetching pull request commits',
      userMessage:
        'Could not load all pull request commits because the result set is unusually large. Please narrow scope and retry.',
    });
  }

  async getCheckRuns(owner: string, repo: string, ref: string): Promise<CheckSignals> {
    interface GitHubCheckRunsResponse {
      total_count: number;
      check_runs: Array<{
        id: number;
        name: string;
        status: string;
        conclusion: string | null;
      }>;
    }

    try {
      const data = await this.get<GitHubCheckRunsResponse>(
        `/repos/${owner}/${repo}/commits/${ref}/check-runs`,
        { params: { per_page: 100 } }
      );

      const items: NormalizedCheckRun[] = data.check_runs.map((run) => ({
        id: run.id,
        name: run.name,
        status: normalizeCheckRunStatus(run.status),
        conclusion: run.conclusion,
      }));

      const failing = items.filter(isCheckRunFailing).length;
      const pending = items.filter(isCheckRunPending).length;

      return {
        sourceState: items.length === 0 ? 'ok-empty' : 'ok',
        total: items.length,
        failing,
        pending,
        items,
      };
    } catch (error) {
      if (error instanceof GitHubApiError) {
        if (error.code === 'FORBIDDEN' || error.code === 'NOT_FOUND') {
          return { sourceState: 'unavailable', total: 0, failing: 0, pending: 0, items: [] };
        }
      }
      return { sourceState: 'error', total: 0, failing: 0, pending: 0, items: [] };
    }
  }

  async getCombinedStatus(owner: string, repo: string, ref: string): Promise<StatusSignals> {
    interface GitHubCombinedStatusResponse {
      state: string;
      statuses: Array<{
        context: string;
        state: string;
        description: string | null;
      }>;
    }

    try {
      const data = await this.get<GitHubCombinedStatusResponse>(
        `/repos/${owner}/${repo}/commits/${ref}/status`
      );

      const statuses: NormalizedCommitStatus[] = data.statuses.map((s) => ({
        context: s.context,
        state: normalizeCommitStatusState(s.state),
        description: s.description,
      }));

      return {
        sourceState: statuses.length === 0 ? 'ok-empty' : 'ok',
        state: statuses.length === 0 ? null : normalizeCommitStatusState(data.state),
        statuses,
      };
    } catch (error) {
      if (error instanceof GitHubApiError) {
        if (error.code === 'FORBIDDEN' || error.code === 'NOT_FOUND') {
          return { sourceState: 'unavailable', state: null, statuses: [] };
        }
      }
      return { sourceState: 'error', state: null, statuses: [] };
    }
  }

  async getCodeScanningAlerts(owner: string, repo: string, ref: string): Promise<ScanningSignals> {
    interface GitHubCodeScanningAlert {
      number: number;
      rule: {
        id: string | null;
        severity: string | null;
      };
      state: string;
      most_recent_instance: {
        location: {
          path: string;
          start_line: number;
        } | null;
      } | null;
    }

    try {
      const alerts = await this.get<GitHubCodeScanningAlert[]>(
        `/repos/${owner}/${repo}/code-scanning/alerts`,
        { params: { state: 'open', ref, per_page: 100 } }
      );

      const items: NormalizedScanningAlert[] = alerts.map((alert) => {
        const severity = normalizeCodeScanningSeverity(alert.rule.severity);
        const location = alert.most_recent_instance?.location
          ? `${alert.most_recent_instance.location.path}:${alert.most_recent_instance.location.start_line}`
          : 'unknown';
        return {
          number: alert.number,
          ruleId: alert.rule.id ?? 'unknown',
          severity,
          state: normalizeAlertState(alert.state),
          location,
        };
      });

      const highSeverityCount = items.filter(
        (a) => a.severity === 'critical' || a.severity === 'high'
      ).length;

      return {
        sourceState: items.length === 0 ? 'ok-empty' : 'ok',
        openAlerts: items.length,
        highSeverityCount,
        items,
      };
    } catch (error) {
      if (error instanceof GitHubApiError) {
        if (
          error.code === 'FORBIDDEN' ||
          error.code === 'NOT_FOUND' ||
          error.code === 'VALIDATION_ERROR'
        ) {
          return { sourceState: 'unavailable', openAlerts: 0, highSeverityCount: 0, items: [] };
        }
      }
      return { sourceState: 'error', openAlerts: 0, highSeverityCount: 0, items: [] };
    }
  }

  async validateToken(): Promise<boolean> {
    try {
      await this.client.get('/user');
      return true;
    } catch {
      return false;
    }
  }
}

export function createGitHubService(config: AppConfig): GitHubService {
  return new GitHubService(config);
}
