import { useEffect, useState } from 'react';
import { GitPullRequest, FlaskConical, Loader2, AlertCircle, Star, RefreshCw, X } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  setSelectedPR,
  setPRFiles,
  setPRComments,
  setPRReviewComments,
  setPRReviews,
  setPRCommits,
  resetSummaryState,
  setPRList,
  setActiveRepository,
  fetchPullRequestContext,
  fetchRepositoryPRList,
  generatePRSummary,
} from '../store/slices/prsSlice';
import {
  addWatchedRepo,
  fetchWatchedRepoPRCount,
  removeWatchedRepo,
  setWatchedRepoCount,
} from '../store/slices/watchedReposSlice';
import { clearMessages } from '../store/slices/chatSlice';
import { setDemoMode } from '../store/slices/configSlice';
import { dummyPR, dummyFiles, dummyComments, dummyReviewComments, dummyReviews } from '../services/dummyData';
import { cn, formatDate } from '../lib/utils';
import type { PRListItem, PullRequest } from '../types';
import { PRList } from './PRList';

interface PRFormValues {
  owner: string;
  repo: string;
  prNumber: number | null;
}

function parseRepository(value: string): { owner: string; repo: string } | null {
  const match = value.trim().match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  if (!match) {
    return null;
  }

  return {
    owner: match[1],
    repo: match[2],
  };
}

function mapPullRequestToListItem(pr: PullRequest): PRListItem {
  return {
    id: pr.id,
    number: pr.number,
    title: pr.title,
    state: pr.state,
    merged: pr.merged,
    user: pr.user,
    updated_at: pr.updated_at,
    base: pr.base,
    head: pr.head,
  };
}

function PRItem({ pr, isSelected, onClick }: { pr: PullRequest; isSelected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left px-3 py-2.5 rounded-md transition-colors',
        'hover:bg-accent',
        isSelected ? 'bg-accent text-accent-foreground' : 'text-foreground'
      )}
    >
      <div className="flex items-start gap-2">
        <GitPullRequest
          className={cn(
            'h-4 w-4 flex-shrink-0 mt-0.5',
            pr.state === 'open' ? 'text-green-500' : pr.merged ? 'text-purple-500' : 'text-red-500'
          )}
        />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate">{pr.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            #{pr.number} · {pr.user.login} · {formatDate(pr.updated_at)}
          </p>
        </div>
      </div>
    </button>
  );
}

export function Sidebar() {
  const dispatch = useAppDispatch();
  const config = useAppSelector((state) => state.config.config);
  const {
    selectedPR,
    prList,
    activeRepository,
    isLoading,
    error,
    loadingByResource,
    errorByResource,
  } = useAppSelector((state) => state.prs);
  const watchedRepos = useAppSelector((state) => state.watchedRepos.items);

  const [repositoryInput, setRepositoryInput] = useState('');
  const [prNumberInput, setPrNumberInput] = useState('');
  const [repositoryError, setRepositoryError] = useState<string | null>(null);
  const [prNumberError, setPrNumberError] = useState<string | null>(null);
  const [sidebarView, setSidebarView] = useState<'controls' | 'repoList'>('controls');

  const isPRListLoading = loadingByResource.prList;
  const prListError = errorByResource.prList;

  useEffect(() => {
    if (config.demoMode || watchedRepos.length === 0) {
      return;
    }

    watchedRepos.forEach((repo) => {
      if (repo.openPRCount === null && !repo.isLoadingCount && !repo.countError) {
        void dispatch(fetchWatchedRepoPRCount({ owner: repo.owner, repo: repo.repo }));
      }
    });
  }, [config.demoMode, watchedRepos, dispatch]);

  useEffect(() => {
    if (config.demoMode && !selectedPR) {
      dispatch(setSelectedPR(dummyPR));
      dispatch(setPRFiles(dummyFiles));
      dispatch(setPRComments(dummyComments));
      dispatch(setPRReviewComments(dummyReviewComments));
      dispatch(setPRReviews(dummyReviews));
      dispatch(setPRCommits([]));
      dispatch(setPRList([mapPullRequestToListItem(dummyPR)]));
      if (config.summaryEnabled) {
        void dispatch(generatePRSummary({ owner: 'demo', repo: 'demo', prNumber: dummyPR.number }));
      }
    }
  }, [config.demoMode, config.summaryEnabled, selectedPR, dispatch]);

  const handleSelectDemoPR = () => {
    dispatch(clearMessages());
    dispatch(setSelectedPR(dummyPR));
    dispatch(setPRFiles(dummyFiles));
    dispatch(setPRComments(dummyComments));
    dispatch(setPRReviewComments(dummyReviewComments));
    dispatch(setPRReviews(dummyReviews));
    dispatch(setPRCommits([]));
    dispatch(setPRList([mapPullRequestToListItem(dummyPR)]));
    if (config.summaryEnabled) {
      void dispatch(generatePRSummary({ owner: 'demo', repo: 'demo', prNumber: dummyPR.number }));
    } else {
      dispatch(resetSummaryState());
    }
  };

  const handleToggleDemoMode = () => {
    dispatch(setDemoMode(!config.demoMode));
    if (!config.demoMode) {
      dispatch(clearMessages());
      dispatch(setSelectedPR(dummyPR));
      dispatch(setPRFiles(dummyFiles));
      dispatch(setPRComments(dummyComments));
      dispatch(setPRReviewComments(dummyReviewComments));
      dispatch(setPRReviews(dummyReviews));
      dispatch(setPRCommits([]));
      dispatch(setPRList([mapPullRequestToListItem(dummyPR)]));
      setSidebarView('controls');
      if (config.summaryEnabled) {
        void dispatch(generatePRSummary({ owner: 'demo', repo: 'demo', prNumber: dummyPR.number }));
      }
    } else {
      dispatch(clearMessages());
      dispatch(setSelectedPR(null));
      dispatch(setPRList([]));
      dispatch(setActiveRepository(null));
      setSidebarView('controls');
    }
  };

  const validateInputs = (): PRFormValues | null => {
    const repository = parseRepository(repositoryInput);
    const trimmedPRNumber = prNumberInput.trim();
    let parsedPRNumber: number | null = null;
    let hasError = false;

    if (!repository) {
      setRepositoryError('Enter repository as owner/repo.');
      hasError = true;
    } else {
      setRepositoryError(null);
    }

    if (trimmedPRNumber.length > 0) {
      const maybePRNumber = Number(trimmedPRNumber);
      if (!Number.isInteger(maybePRNumber) || maybePRNumber <= 0) {
        setPrNumberError('Enter a valid PR number (positive integer).');
        hasError = true;
      } else {
        parsedPRNumber = maybePRNumber;
        setPrNumberError(null);
      }
    } else {
      setPrNumberError(null);
    }

    if (hasError || !repository) {
      return null;
    }

    return {
      owner: repository.owner,
      repo: repository.repo,
      prNumber: parsedPRNumber,
    };
  };

  const loadPullRequestContext = async (
    values: { owner: string; repo: string; prNumber: number },
    options?: { showSingleInList?: boolean }
  ): Promise<boolean> => {
    dispatch(clearMessages());
    const contextAction = await dispatch(fetchPullRequestContext(values));
    if (fetchPullRequestContext.rejected.match(contextAction)) {
      return false;
    }

    const pr = contextAction.payload.pullRequest;
    if (options?.showSingleInList) {
      dispatch(setPRList([mapPullRequestToListItem(pr)]));
      dispatch(setActiveRepository({ owner: values.owner, repo: values.repo }));
      setSidebarView('repoList');
    }

    if (config.summaryEnabled) {
      await dispatch(generatePRSummary(values));
    } else {
      dispatch(resetSummaryState());
    }

    return true;
  };

  const loadRepositoryPRList = async (owner: string, repo: string): Promise<boolean> => {
    dispatch(setActiveRepository({ owner, repo }));
    const listAction = await dispatch(fetchRepositoryPRList({ owner, repo }));
    return fetchRepositoryPRList.fulfilled.match(listAction);
  };

  const handleLoadPR = () => {
    const values = validateInputs();
    if (!values) {
      return;
    }

    dispatch(setActiveRepository({ owner: values.owner, repo: values.repo }));

    if (values.prNumber === null) {
      dispatch(clearMessages());
      dispatch(setSelectedPR(null));
      setSidebarView('repoList');
      void loadRepositoryPRList(values.owner, values.repo);
      return;
    }

    setSidebarView('repoList');
    void loadPullRequestContext(
      {
        owner: values.owner,
        repo: values.repo,
        prNumber: values.prNumber,
      },
      { showSingleInList: true }
    );
  };

  const handleSelectPRFromList = (item: PRListItem) => {
    const repository =
      activeRepository ||
      parseRepository(item.base.repo?.full_name || item.head.repo?.full_name || repositoryInput);
    if (!repository) {
      return;
    }

    setRepositoryInput(`${repository.owner}/${repository.repo}`);
    setPrNumberInput(String(item.number));
    setRepositoryError(null);
    setPrNumberError(null);

    void loadPullRequestContext({
      owner: repository.owner,
      repo: repository.repo,
      prNumber: item.number,
    });
  };

  const handleRefreshList = () => {
    if (!activeRepository || config.demoMode) {
      return;
    }
    void loadRepositoryPRList(activeRepository.owner, activeRepository.repo);
  };

  const handleBackToControls = () => {
    setSidebarView('controls');
  };

  const currentInputRepository = parseRepository(repositoryInput);
  const isCurrentRepoWatched =
    currentInputRepository !== null &&
    watchedRepos.some(
      (repo) => repo.owner === currentInputRepository.owner && repo.repo === currentInputRepository.repo
    );

  const handleToggleWatchCurrentRepository = async () => {
    const repository = parseRepository(repositoryInput);
    if (!repository) {
      setRepositoryError('Enter repository as owner/repo.');
      return;
    }

    const fullName = `${repository.owner}/${repository.repo}`;
    const existing = watchedRepos.find((repo) => repo.fullName === fullName);
    if (existing) {
      dispatch(removeWatchedRepo(fullName));
      return;
    }

    const countAction = await dispatch(
      fetchWatchedRepoPRCount({ owner: repository.owner, repo: repository.repo })
    );
    if (fetchWatchedRepoPRCount.rejected.match(countAction)) {
      setRepositoryError(countAction.payload?.userMessage || 'Unable to watch repository.');
      return;
    }

    setRepositoryError(null);
    dispatch(addWatchedRepo({ owner: repository.owner, repo: repository.repo }));
    dispatch(setWatchedRepoCount(countAction.payload));
  };

  const handleOpenWatchedRepo = (owner: string, repo: string) => {
    setRepositoryInput(`${owner}/${repo}`);
    setPrNumberInput('');
    setRepositoryError(null);
    setPrNumberError(null);
    setSidebarView('repoList');
    void loadRepositoryPRList(owner, repo);
  };

  const handleRefreshWatchedRepo = (owner: string, repo: string) => {
    void dispatch(fetchWatchedRepoPRCount({ owner, repo }));
  };

  const loadingLabel =
    prNumberInput.trim().length > 0 || loadingByResource.metadata ? 'Loading PR...' : 'Loading PRs...';
  const loadButtonLabel = prNumberInput.trim().length > 0 ? 'Load PR' : 'Load All PRs';

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex-shrink-0">
        <h1 className="text-sm font-semibold text-foreground">PR Review</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          {config.demoMode ? 'Demo Mode' : config.githubInstance}
        </p>
      </div>

      <div className="px-3 py-2 border-b border-border flex-shrink-0">
        <button
          onClick={handleToggleDemoMode}
          className={cn(
            'w-full flex items-center gap-2 rounded-md px-3 py-2 text-xs transition-colors',
            config.demoMode
              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent'
          )}
        >
          <FlaskConical className="h-3.5 w-3.5" />
          <span>{config.demoMode ? 'Demo Mode (click to disable)' : 'Enable Demo Mode'}</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-3 py-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Pull Requests
            </span>
          </div>

          {config.demoMode ? (
            <PRItem
              pr={dummyPR}
              isSelected={selectedPR?.id === dummyPR.id}
              onClick={handleSelectDemoPR}
            />
          ) : sidebarView === 'repoList' ? (
            <PRList
              repositoryLabel={
                activeRepository ? `${activeRepository.owner}/${activeRepository.repo}` : repositoryInput || 'Repository'
              }
              items={prList}
              selectedPRId={selectedPR?.id ?? null}
              isLoading={isPRListLoading}
              error={prListError}
              onBack={handleBackToControls}
              onRefresh={handleRefreshList}
              onSelect={handleSelectPRFromList}
            />
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1" htmlFor="sidebar-repository">
                  Repository
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="sidebar-repository"
                    type="text"
                    value={repositoryInput}
                    onChange={(event) => setRepositoryInput(event.target.value)}
                    placeholder="owner/repo"
                    disabled={isLoading}
                    className={cn(
                      'flex-1 rounded-md border bg-background px-2.5 py-1.5 text-xs',
                      'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
                      'disabled:opacity-50',
                      repositoryError ? 'border-destructive' : 'border-input'
                    )}
                  />
                  <button
                    onClick={() => {
                      void handleToggleWatchCurrentRepository();
                    }}
                    type="button"
                    disabled={isLoading}
                    className={cn(
                      'inline-flex items-center justify-center rounded-md border border-input bg-background px-2 py-1.5',
                      'text-muted-foreground hover:text-foreground hover:bg-accent transition-colors',
                      'disabled:opacity-50',
                      isCurrentRepoWatched && 'text-amber-500'
                    )}
                    title={isCurrentRepoWatched ? 'Unwatch repository' : 'Watch repository'}
                  >
                    <Star className={cn('h-3.5 w-3.5', isCurrentRepoWatched && 'fill-current')} />
                  </button>
                </div>
                {repositoryError && <p className="mt-1 text-xs text-destructive">{repositoryError}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1" htmlFor="sidebar-pr-number">
                  PR Number
                </label>
                <input
                  id="sidebar-pr-number"
                  type="number"
                  min={1}
                  value={prNumberInput}
                  onChange={(event) => setPrNumberInput(event.target.value)}
                  placeholder="Optional"
                  disabled={isLoading}
                  className={cn(
                    'w-full rounded-md border bg-background px-2.5 py-1.5 text-xs',
                    'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
                    'disabled:opacity-50',
                    prNumberError ? 'border-destructive' : 'border-input'
                  )}
                />
                {prNumberError && <p className="mt-1 text-xs text-destructive">{prNumberError}</p>}
              </div>

              <button
                onClick={handleLoadPR}
                disabled={isLoading}
                className={cn(
                  'w-full flex items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-medium',
                  'bg-primary text-primary-foreground hover:bg-primary/90',
                  'transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>{loadingLabel}</span>
                  </>
                ) : (
                  <>
                    <GitPullRequest className="h-3.5 w-3.5" />
                    <span>{loadButtonLabel}</span>
                  </>
                )}
              </button>

              <div className="space-y-2 pt-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Watched Repositories</p>
                {watchedRepos.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No watched repositories yet.</p>
                ) : (
                  watchedRepos.map((repo) => (
                    <div key={repo.fullName} className="flex items-center gap-1 rounded-md border border-border px-2 py-1.5">
                      <button
                        onClick={() => handleOpenWatchedRepo(repo.owner, repo.repo)}
                        className="flex-1 min-w-0 text-left text-xs text-foreground hover:text-primary"
                      >
                        <span className="truncate block">{repo.fullName}</span>
                      </button>
                      <span className="text-[11px] rounded-full bg-muted px-1.5 py-0.5 text-muted-foreground">
                        {repo.isLoadingCount ? '...' : repo.openPRCount ?? '-'}
                      </span>
                      <button
                        onClick={() => handleRefreshWatchedRepo(repo.owner, repo.repo)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        title={`Refresh ${repo.fullName}`}
                        disabled={repo.isLoadingCount}
                      >
                        <RefreshCw className={cn('h-3.5 w-3.5', repo.isLoadingCount && 'animate-spin')} />
                      </button>
                      <button
                        onClick={() => dispatch(removeWatchedRepo(repo.fullName))}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                        title={`Remove ${repo.fullName}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {(error || watchedRepos.some((repo) => repo.countError)) && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-2">
                  <AlertCircle className="h-3.5 w-3.5 text-destructive mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-destructive">
                    {error || watchedRepos.find((repo) => repo.countError)?.countError}
                  </p>
                </div>
              )}

              {!selectedPR && !isLoading && !error && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  Enter owner/repo and optionally a PR number to load pull requests.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
