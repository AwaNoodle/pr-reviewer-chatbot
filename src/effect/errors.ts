import type { GitHubApiErrorData } from '../types';
import { GitHubApiError } from '../services/github';

export class RequestTimeoutError extends Error {
  readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    super(`GitHub request timed out after ${timeoutMs}ms`);
    this.name = 'RequestTimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

export type PullRequestContextError =
  | {
      _tag: 'GitHubApiError';
      data: GitHubApiErrorData;
    }
  | {
      _tag: 'TimeoutError';
      data: GitHubApiErrorData;
    }
  | {
      _tag: 'UnexpectedError';
      data: GitHubApiErrorData;
      cause: unknown;
    };

export function toPullRequestContextError(
  error: unknown,
  fallbackUserMessage: string
): PullRequestContextError {
  if (error instanceof GitHubApiError) {
    return {
      _tag: 'GitHubApiError',
      data: error.toJSON(),
    };
  }

  if (error instanceof RequestTimeoutError) {
    return {
      _tag: 'TimeoutError',
      data: {
        code: 'NETWORK_ERROR',
        status: null,
        message: error.message,
        userMessage: 'GitHub request timed out. Please retry.',
      },
    };
  }

  return {
    _tag: 'UnexpectedError',
    data: {
      code: 'UNKNOWN_ERROR',
      status: null,
      message: error instanceof Error ? error.message : 'Unexpected GitHub API error',
      userMessage: fallbackUserMessage,
    },
    cause: error,
  };
}

export function toRejectedErrorData(
  error: unknown,
  fallbackUserMessage = 'Something went wrong while loading pull request data.'
): GitHubApiErrorData {
  if (typeof error === 'object' && error !== null && '_tag' in error && 'data' in error) {
    const typedError = error as PullRequestContextError;
    return typedError.data;
  }

  if (error instanceof GitHubApiError) {
    return error.toJSON();
  }

  return {
    code: 'UNKNOWN_ERROR',
    status: null,
    message: error instanceof Error ? error.message : 'Unexpected GitHub API error',
    userMessage: fallbackUserMessage,
  };
}
