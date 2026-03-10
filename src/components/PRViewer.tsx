import { useState } from 'react';
import { ChevronRight, FileCode, FilePlus, FileMinus, FileEdit, Loader2, AlertCircle, Inbox } from 'lucide-react';
import { useAppSelector } from '../store/hooks';
import { cn, formatDate } from '../lib/utils';
import type { PRFile } from '../types';

function getFileIcon(status: PRFile['status']) {
  switch (status) {
    case 'added':
      return <FilePlus className="h-3.5 w-3.5 text-green-500" />;
    case 'removed':
      return <FileMinus className="h-3.5 w-3.5 text-red-500" />;
    case 'modified':
      return <FileEdit className="h-3.5 w-3.5 text-yellow-500" />;
    default:
      return <FileCode className="h-3.5 w-3.5 text-muted-foreground" />;
  }
}

function getStatusBadge(status: PRFile['status']) {
  const classes = {
    added: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    removed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    modified: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    renamed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    copied: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    changed: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    unchanged: 'bg-muted text-muted-foreground',
  };
  return (
    <span className={cn('text-xs px-1.5 py-0.5 rounded font-medium', classes[status] ?? classes.unchanged)}>
      {status}
    </span>
  );
}

function DiffView({ patch }: { patch: string }) {
  const lines = patch.split('\n');
  return (
    <div className="font-mono text-xs overflow-x-auto">
      {lines.map((line, i) => {
        let lineClass = 'diff-context';
        if (line.startsWith('+') && !line.startsWith('+++')) lineClass = 'diff-add';
        else if (line.startsWith('-') && !line.startsWith('---')) lineClass = 'diff-remove';
        else if (line.startsWith('@@')) lineClass = 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30';

        return (
          <div key={i} className={cn('px-3 py-0.5 whitespace-pre', lineClass)}>
            {line || ' '}
          </div>
        );
      })}
    </div>
  );
}

function FileItem({ file }: { file: PRFile }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-border rounded-md overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2 text-left',
          'bg-muted/50 hover:bg-muted transition-colors',
          'text-sm'
        )}
      >
        <ChevronRight
          className={cn(
            'h-3.5 w-3.5 text-muted-foreground flex-shrink-0 transition-transform duration-200',
            expanded && 'rotate-90'
          )}
        />
        {getFileIcon(file.status)}
        <span className="flex-1 truncate font-mono text-xs">{file.filename}</span>
        <div className="flex items-center gap-2 flex-shrink-0">
          {getStatusBadge(file.status)}
          <span className="text-xs text-green-600 dark:text-green-400">+{file.additions}</span>
          <span className="text-xs text-red-600 dark:text-red-400">-{file.deletions}</span>
        </div>
      </button>
      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-200 ease-out',
          expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        )}
      >
        <div className="overflow-hidden">
          <div className="border-t border-border">
            {file.patch ? (
              <DiffView patch={file.patch} />
            ) : (
              <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                No diff available for this file
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="animate-fade-slide-in rounded-md border border-border bg-muted/20 p-4 space-y-3">
      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>{label}</span>
      </div>
      <div className="space-y-2">
        <div className="h-8 w-full rounded-md bg-muted/60 animate-pulse" />
        <div className="h-8 w-full rounded-md bg-muted/60 animate-pulse" />
        <div className="h-8 w-4/5 rounded-md bg-muted/60 animate-pulse" />
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="animate-fade-slide-in flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5">
      <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
      <p className="text-xs text-destructive">{message}</p>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="animate-fade-slide-in flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border py-10 text-center">
      <Inbox className="h-5 w-5 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

export function PRViewer() {
  const { selectedPR, files, comments, reviews, loadingByResource, errorByResource } = useAppSelector(
    (state) => state.prs
  );
  const [activeTab, setActiveTab] = useState<'files' | 'comments' | 'reviews'>('files');

  if (!selectedPR) {
    if (loadingByResource.metadata) {
      return (
        <div className="flex items-center justify-center h-full p-4">
          <LoadingState label="Loading pull request details..." />
        </div>
      );
    }

    if (errorByResource.metadata) {
      return (
        <div className="flex items-center justify-center h-full p-4">
          <ErrorState message={errorByResource.metadata} />
        </div>
      );
    }

    return (
      <div className="flex items-center justify-center h-full p-4">
        <EmptyState message="Select a pull request to view details." />
      </div>
    );
  }

  const tabs = [
    { id: 'files' as const, label: `Files (${files.length})` },
    { id: 'comments' as const, label: `Comments (${comments.length})` },
    { id: 'reviews' as const, label: `Reviews (${reviews.length})` },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* PR Header */}
      <div className="p-4 border-b border-border flex-shrink-0">
        <div className="flex items-start gap-2 mb-2">
          <span
            className={cn(
              'text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 mt-0.5',
              selectedPR.state === 'open'
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : selectedPR.merged
                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
            )}
          >
            {selectedPR.merged ? 'merged' : selectedPR.state}
          </span>
          <h2 className="text-sm font-semibold text-foreground leading-tight">
            #{selectedPR.number} {selectedPR.title}
          </h2>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>by {selectedPR.user.login}</span>
          <span>·</span>
          <span>{formatDate(selectedPR.created_at)}</span>
          <span>·</span>
          <span className="font-mono">
            {selectedPR.head.ref} → {selectedPR.base.ref}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-2 text-xs">
          <span className="text-green-600 dark:text-green-400">+{selectedPR.additions}</span>
          <span className="text-red-600 dark:text-red-400">-{selectedPR.deletions}</span>
          <span className="text-muted-foreground">{selectedPR.changed_files} files</span>
        </div>
        {loadingByResource.metadata && (
          <div className="mt-2 h-1 w-full overflow-hidden rounded bg-muted">
            <div className="loading-indicator h-full w-2/5 rounded bg-primary/70" />
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border flex-shrink-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-4 py-2 text-xs font-medium transition-colors',
              activeTab === tab.id
                ? 'border-b-2 border-primary text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {activeTab === 'files' && (
          <div className="space-y-2 animate-fade-slide-in">
            {loadingByResource.files ? (
              <LoadingState label="Loading changed files..." />
            ) : errorByResource.files ? (
              <ErrorState message={errorByResource.files} />
            ) : files.length === 0 ? (
              <EmptyState message="No files changed in this pull request." />
            ) : (
              files.map((file) => <FileItem key={file.sha + file.filename} file={file} />)
            )}
          </div>
        )}

        {activeTab === 'comments' && (
          <div className="space-y-2 animate-fade-slide-in">
            {loadingByResource.comments ? (
              <LoadingState label="Loading comments..." />
            ) : errorByResource.comments ? (
              <ErrorState message={errorByResource.comments} />
            ) : comments.length === 0 ? (
              <EmptyState message="No issue comments on this pull request." />
            ) : (
              comments.map((comment) => (
                <div key={comment.id} className="rounded-md border border-border p-3 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-foreground">{comment.user.login}</span>
                    <span className="text-xs text-muted-foreground">{formatDate(comment.created_at)}</span>
                  </div>
                  <p className="text-sm text-foreground">{comment.body}</p>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'reviews' && (
          <div className="space-y-2 animate-fade-slide-in">
            {loadingByResource.reviews ? (
              <LoadingState label="Loading reviews..." />
            ) : errorByResource.reviews ? (
              <ErrorState message={errorByResource.reviews} />
            ) : reviews.length === 0 ? (
              <EmptyState message="No reviews have been submitted." />
            ) : (
              reviews.map((review) => (
                <div key={review.id} className="rounded-md border border-border p-3 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-foreground">{review.user.login}</span>
                    <span
                      className={cn(
                        'text-xs px-1.5 py-0.5 rounded font-medium',
                        review.state === 'APPROVED'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : review.state === 'CHANGES_REQUESTED'
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          : 'bg-muted text-muted-foreground'
                      )}
                    >
                      {review.state.replace('_', ' ')}
                    </span>
                    <span className="text-xs text-muted-foreground">{formatDate(review.submitted_at)}</span>
                  </div>
                  {review.body && <p className="text-sm text-foreground">{review.body}</p>}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
