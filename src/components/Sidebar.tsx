import { useEffect, useState } from 'react';
import { GitPullRequest, RefreshCw, FlaskConical, Loader2, AlertCircle } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  setSelectedPR,
  setPRFiles,
  setPRComments,
  setPRReviewComments,
  setPRReviews,
  setPRCommits,
  resetSummaryState,
  fetchPullRequest,
  fetchPRFiles,
  fetchPRComments,
  fetchPRReviewComments,
  fetchPRReviews,
  fetchPRCommits,
  generatePRSummary,
} from '../store/slices/prsSlice';
import { clearMessages } from '../store/slices/chatSlice';
import { setDemoMode } from '../store/slices/configSlice';
import { dummyPR, dummyFiles, dummyComments, dummyReviewComments, dummyReviews } from '../services/dummyData';
import { cn, formatDate } from '../lib/utils';
import type { PullRequest } from '../types';

interface PRFormValues {
  owner: string;
  repo: string;
  prNumber: number;
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
  const selectedPR = useAppSelector((state) => state.prs.selectedPR);
  const isLoading = useAppSelector((state) => state.prs.isLoading);
  const prsError = useAppSelector((state) => state.prs.error);
  const [repositoryInput, setRepositoryInput] = useState('');
  const [prNumberInput, setPrNumberInput] = useState('');
  const [repositoryError, setRepositoryError] = useState<string | null>(null);
  const [prNumberError, setPrNumberError] = useState<string | null>(null);

  // Load demo PR on mount if in demo mode
  useEffect(() => {
    if (config.demoMode && !selectedPR) {
      dispatch(setSelectedPR(dummyPR));
      dispatch(setPRFiles(dummyFiles));
      dispatch(setPRComments(dummyComments));
      dispatch(setPRReviewComments(dummyReviewComments));
      dispatch(setPRReviews(dummyReviews));
      dispatch(setPRCommits([]));
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
    if (config.summaryEnabled) {
      void dispatch(generatePRSummary({ owner: 'demo', repo: 'demo', prNumber: dummyPR.number }));
    } else {
      dispatch(resetSummaryState());
    }
  };

  const handleToggleDemoMode = () => {
    dispatch(setDemoMode(!config.demoMode));
    if (!config.demoMode) {
      // Switching to demo mode - load dummy data
      dispatch(clearMessages());
      dispatch(setSelectedPR(dummyPR));
      dispatch(setPRFiles(dummyFiles));
      dispatch(setPRComments(dummyComments));
      dispatch(setPRReviewComments(dummyReviewComments));
      dispatch(setPRReviews(dummyReviews));
      dispatch(setPRCommits([]));
      if (config.summaryEnabled) {
        void dispatch(generatePRSummary({ owner: 'demo', repo: 'demo', prNumber: dummyPR.number }));
      }
    } else {
      // Switching to GitHub mode - clear selection
      dispatch(clearMessages());
      dispatch(setSelectedPR(null));
    }
  };

  const validateInputs = (): PRFormValues | null => {
    const repository = parseRepository(repositoryInput);
    const parsedPRNumber = Number(prNumberInput.trim());
    let hasError = false;

    if (!repository) {
      setRepositoryError('Enter repository as owner/repo.');
      hasError = true;
    } else {
      setRepositoryError(null);
    }

    if (!Number.isInteger(parsedPRNumber) || parsedPRNumber <= 0) {
      setPrNumberError('Enter a valid PR number (positive integer).');
      hasError = true;
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

  const loadPullRequestContext = async (values: PRFormValues) => {
    dispatch(clearMessages());
    const metadataAction = await dispatch(fetchPullRequest(values));
    if (fetchPullRequest.rejected.match(metadataAction)) {
      return;
    }

    await Promise.all([
      dispatch(fetchPRFiles(values)),
      dispatch(fetchPRComments(values)),
      dispatch(fetchPRReviewComments(values)),
      dispatch(fetchPRReviews(values)),
      dispatch(fetchPRCommits(values)),
    ]);

    if (config.summaryEnabled) {
      await dispatch(generatePRSummary(values));
    } else {
      dispatch(resetSummaryState());
    }
  };

  const handleLoadPR = () => {
    const values = validateInputs();
    if (!values) {
      return;
    }
    void loadPullRequestContext(values);
  };

  const handleRefresh = () => {
    if (!selectedPR || config.demoMode) {
      return;
    }

    const repoFullName = selectedPR.base.repo?.full_name || selectedPR.head.repo?.full_name || repositoryInput;
    const repository = parseRepository(repoFullName);
    if (!repository) {
      return;
    }

    setRepositoryInput(`${repository.owner}/${repository.repo}`);
    setPrNumberInput(String(selectedPR.number));
    setRepositoryError(null);
    setPrNumberError(null);

    void loadPullRequestContext({
      owner: repository.owner,
      repo: repository.repo,
      prNumber: selectedPR.number,
    });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex-shrink-0">
        <h1 className="text-sm font-semibold text-foreground">PR Review</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          {config.demoMode ? 'Demo Mode' : config.githubInstance}
        </p>
      </div>

      {/* Demo Mode Toggle */}
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

      {/* PR List */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-3 py-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Pull Requests
            </span>
            {!config.demoMode && (
              <button
                onClick={handleRefresh}
                disabled={isLoading || !selectedPR}
                className="text-muted-foreground hover:text-foreground transition-colors"
                title="Refresh"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
              </button>
            )}
          </div>

          {config.demoMode ? (
            <PRItem
              pr={dummyPR}
              isSelected={selectedPR?.id === dummyPR.id}
              onClick={handleSelectDemoPR}
            />
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1" htmlFor="sidebar-repository">
                  Repository
                </label>
                <input
                  id="sidebar-repository"
                  type="text"
                  value={repositoryInput}
                  onChange={(e) => setRepositoryInput(e.target.value)}
                  placeholder="owner/repo"
                  disabled={isLoading}
                  className={cn(
                    'w-full rounded-md border bg-background px-2.5 py-1.5 text-xs',
                    'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
                    'disabled:opacity-50',
                    repositoryError ? 'border-destructive' : 'border-input'
                  )}
                />
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
                  onChange={(e) => setPrNumberInput(e.target.value)}
                  placeholder="123"
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
                    <span>Loading PR...</span>
                  </>
                ) : (
                  <>
                    <GitPullRequest className="h-3.5 w-3.5" />
                    <span>Load PR</span>
                  </>
                )}
              </button>

              {prsError && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-2">
                  <AlertCircle className="h-3.5 w-3.5 text-destructive mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-destructive">{prsError}</p>
                </div>
              )}

              {!selectedPR && !isLoading && !prsError && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  Enter owner/repo and PR number to load pull request details.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
