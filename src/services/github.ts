import axios, { type AxiosInstance } from 'axios';
import type {
  GitHubRepository,
  PullRequest,
  PRFile,
  PRComment,
  PRReviewComment,
  PRReview,
  AppConfig,
} from '../types';

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

  async listRepositories(page = 1, perPage = 30): Promise<GitHubRepository[]> {
    const response = await this.client.get<GitHubRepository[]>('/user/repos', {
      params: {
        sort: 'updated',
        per_page: perPage,
        page,
      },
    });
    return response.data;
  }

  async searchRepositories(query: string, page = 1): Promise<GitHubRepository[]> {
    const response = await this.client.get<{ items: GitHubRepository[] }>(
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
    return response.data.items;
  }

  async listPullRequests(
    owner: string,
    repo: string,
    state: 'open' | 'closed' | 'all' = 'open',
    page = 1,
    perPage = 30
  ): Promise<PullRequest[]> {
    const response = await this.client.get<PullRequest[]>(
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
    return response.data;
  }

  async getPullRequest(owner: string, repo: string, prNumber: number): Promise<PullRequest> {
    const response = await this.client.get<PullRequest>(
      `/repos/${owner}/${repo}/pulls/${prNumber}`
    );
    return response.data;
  }

  async getPRFiles(owner: string, repo: string, prNumber: number): Promise<PRFile[]> {
    const response = await this.client.get<PRFile[]>(
      `/repos/${owner}/${repo}/pulls/${prNumber}/files`,
      {
        params: { per_page: 100 },
      }
    );
    return response.data;
  }

  async getPRComments(owner: string, repo: string, prNumber: number): Promise<PRComment[]> {
    const response = await this.client.get<PRComment[]>(
      `/repos/${owner}/${repo}/issues/${prNumber}/comments`,
      {
        params: { per_page: 100 },
      }
    );
    return response.data;
  }

  async getPRReviewComments(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<PRReviewComment[]> {
    const response = await this.client.get<PRReviewComment[]>(
      `/repos/${owner}/${repo}/pulls/${prNumber}/comments`,
      {
        params: { per_page: 100 },
      }
    );
    return response.data;
  }

  async getPRReviews(owner: string, repo: string, prNumber: number): Promise<PRReview[]> {
    const response = await this.client.get<PRReview[]>(
      `/repos/${owner}/${repo}/pulls/${prNumber}/reviews`
    );
    return response.data;
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
