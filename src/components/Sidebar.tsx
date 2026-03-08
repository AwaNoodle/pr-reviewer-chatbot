import { useEffect } from 'react';
import { GitPullRequest, RefreshCw, FlaskConical } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setSelectedPR, setPRFiles, setPRComments, setPRReviewComments, setPRReviews } from '../store/slices/prsSlice';
import { setDemoMode } from '../store/slices/configSlice';
import { dummyPR, dummyFiles, dummyComments, dummyReviewComments, dummyReviews } from '../services/dummyData';
import { cn, formatDate } from '../lib/utils';
import type { PullRequest } from '../types';

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

  // Load demo PR on mount if in demo mode
  useEffect(() => {
    if (config.demoMode && !selectedPR) {
      dispatch(setSelectedPR(dummyPR));
      dispatch(setPRFiles(dummyFiles));
      dispatch(setPRComments(dummyComments));
      dispatch(setPRReviewComments(dummyReviewComments));
      dispatch(setPRReviews(dummyReviews));
    }
  }, [config.demoMode, selectedPR, dispatch]);

  const handleSelectDemoPR = () => {
    dispatch(setSelectedPR(dummyPR));
    dispatch(setPRFiles(dummyFiles));
    dispatch(setPRComments(dummyComments));
    dispatch(setPRReviewComments(dummyReviewComments));
    dispatch(setPRReviews(dummyReviews));
  };

  const handleToggleDemoMode = () => {
    dispatch(setDemoMode(!config.demoMode));
    if (!config.demoMode) {
      // Switching to demo mode - load dummy data
      dispatch(setSelectedPR(dummyPR));
      dispatch(setPRFiles(dummyFiles));
      dispatch(setPRComments(dummyComments));
      dispatch(setPRReviewComments(dummyReviewComments));
      dispatch(setPRReviews(dummyReviews));
    } else {
      // Switching to GitHub mode - clear selection
      dispatch(setSelectedPR(null));
    }
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
                className="text-muted-foreground hover:text-foreground transition-colors"
                title="Refresh"
              >
                <RefreshCw className="h-3.5 w-3.5" />
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
            <div className="text-center py-6 space-y-2">
              <GitPullRequest className="h-8 w-8 text-muted-foreground mx-auto" />
              <p className="text-xs text-muted-foreground">
                Configure GitHub credentials in Settings to browse PRs
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
