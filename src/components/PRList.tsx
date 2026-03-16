import { ArrowLeft, GitPullRequest, Loader2, RefreshCw } from 'lucide-react';
import { cn, formatDate } from '../lib/utils';
import type { PRListItem } from '../types';

interface PRListProps {
  repositoryLabel: string;
  items: PRListItem[];
  selectedPRId: number | null;
  isLoading: boolean;
  error: string | null;
  onBack: () => void;
  onRefresh: () => void;
  onSelect: (item: PRListItem) => void;
}

export function PRList({
  repositoryLabel,
  items,
  selectedPRId,
  isLoading,
  error,
  onBack,
  onRefresh,
  onSelect,
}: PRListProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back</span>
        </button>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          title="Refresh repository PR list"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
        </button>
      </div>

      <div className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{repositoryLabel}</span>
        <span className="ml-1">({items.length} open)</span>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-2">
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/20 px-2.5 py-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          <p className="text-xs text-muted-foreground">Loading pull requests...</p>
        </div>
      )}

      {!isLoading && !error && items.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-2">No open pull requests found.</p>
      )}

      <div className="space-y-1">
        {items.map((pr) => (
          <button
            key={pr.id}
            onClick={() => onSelect(pr)}
            className={cn(
              'w-full text-left px-3 py-2.5 rounded-md transition-colors',
              'hover:bg-accent',
              selectedPRId === pr.id ? 'bg-accent text-accent-foreground' : 'text-foreground'
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
        ))}
      </div>
    </div>
  );
}
