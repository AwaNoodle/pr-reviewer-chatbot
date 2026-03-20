import { Effect } from 'effect';
import type { PullRequest, PRFile, PRComment, PRReviewComment, PRReview, PRCommit } from '../types';
import type { GitHubService } from '../services/github';
import { RequestTimeoutError, toPullRequestContextError, type PullRequestContextError } from './errors';

const DEFAULT_TIMEOUT_MS = 12000;
const DEFAULT_RETRIES = 1;

export interface PRRequestArgs {
  owner: string;
  repo: string;
  prNumber: number;
}

export interface PullRequestContextData {
  pullRequest: PullRequest;
  files: PRFile[];
  comments: PRComment[];
  reviewComments: PRReviewComment[];
  reviews: PRReview[];
  commits: PRCommit[];
}

interface RequestPolicy {
  timeoutMs: number;
  retries: number;
}

function isTransientError(error: PullRequestContextError): boolean {
  if (error._tag === 'TimeoutError') {
    return true;
  }

  if (error._tag === 'GitHubApiError') {
    return error.data.code === 'NETWORK_ERROR' || error.data.code === 'RATE_LIMITED';
  }

  return false;
}

function withTimeout<A>(operation: () => Promise<A>, timeoutMs: number): Promise<A> {
  return new Promise<A>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new RequestTimeoutError(timeoutMs));
    }, timeoutMs);

    operation().then(
      (value) => {
        clearTimeout(timeoutId);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timeoutId);
        reject(error);
      }
    );
  });
}

function requestWithPolicy<A>(
  operation: () => Promise<A>,
  fallbackUserMessage: string,
  policy: RequestPolicy
): Effect.Effect<A, PullRequestContextError, never> {
  const baseEffect = Effect.tryPromise({
    try: () => withTimeout(operation, policy.timeoutMs),
    catch: (error) => toPullRequestContextError(error, fallbackUserMessage),
  });

  const attempt = (remainingRetries: number): Effect.Effect<A, PullRequestContextError, never> =>
    baseEffect.pipe(
      Effect.catchAll((error) => {
        if (!isTransientError(error) || remainingRetries <= 0) {
          return Effect.fail(error);
        }

        return Effect.sleep('200 millis').pipe(
          Effect.zipRight(attempt(remainingRetries - 1))
        );
      })
    );

  return attempt(policy.retries);
}

type PullRequestContextService = Pick<
  GitHubService,
  'getPullRequest' | 'getPRFiles' | 'getPRComments' | 'getPRReviewComments' | 'getPRReviews' | 'getPRCommits'
>;

export function loadPullRequestContext(
  service: PullRequestContextService,
  args: PRRequestArgs,
  options?: { timeoutMs?: number; retries?: number }
): Effect.Effect<PullRequestContextData, PullRequestContextError, never> {
  const policy: RequestPolicy = {
    timeoutMs: options?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    retries: options?.retries ?? DEFAULT_RETRIES,
  };

  return Effect.gen(function* () {
    const pullRequest = yield* requestWithPolicy(
      () => service.getPullRequest(args.owner, args.repo, args.prNumber),
      'Failed to load pull request metadata.',
      policy
    );

    const [files, comments, reviewComments, reviews, commits] = yield* Effect.all([
      requestWithPolicy(
        () => service.getPRFiles(args.owner, args.repo, args.prNumber),
        'Failed to load pull request files.',
        policy
      ),
      requestWithPolicy(
        () => service.getPRComments(args.owner, args.repo, args.prNumber),
        'Failed to load pull request comments.',
        policy
      ),
      requestWithPolicy(
        () => service.getPRReviewComments(args.owner, args.repo, args.prNumber),
        'Failed to load pull request review comments.',
        policy
      ),
      requestWithPolicy(
        () => service.getPRReviews(args.owner, args.repo, args.prNumber),
        'Failed to load pull request reviews.',
        policy
      ),
      requestWithPolicy(
        () => service.getPRCommits(args.owner, args.repo, args.prNumber),
        'Failed to load pull request commits.',
        policy
      ),
    ]);

    return {
      pullRequest,
      files,
      comments,
      reviewComments,
      reviews,
      commits,
    };
  });
}
