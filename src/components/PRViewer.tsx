import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ChevronRight, FileCode, FilePlus, FileMinus, FileEdit, Loader2, AlertCircle, Inbox, HelpCircle, ShieldAlert, Clock3, CheckCircle2, XCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { setFocusedFile } from '../store/slices/prsSlice';
import { cn, formatDate } from '../lib/utils';
import { resolveCitationForNavigation, normalizeCitationPayload } from '../services/citations';
import { rankAndCapFailingChecks, rankAndCapPendingChecks, rankAndCapScanningAlerts } from '../services/signals';
import type { PRFile, DiffCitation } from '../types';
import { buildDiffLineKeys } from './prViewerUtils';

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

interface CitationChipProps {
  citation: DiffCitation;
  files: PRFile[];
  onNavigate: (fileIndex: number) => void;
}

function CitationChip({ citation, files, onNavigate }: CitationChipProps) {
  const nav = resolveCitationForNavigation(citation, files);
  const displayText = citation.lineStart
    ? citation.lineEnd
      ? `${citation.file}#${citation.lineStart}-${citation.lineEnd}`
      : `${citation.file}#${citation.lineStart}`
    : citation.file;

  return (
    <button
      onClick={() => nav.fileIndex !== null && onNavigate(nav.fileIndex)}
      disabled={nav.fileIndex === null}
      className={cn(
        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-mono',
        'transition-colors',
        nav.fileIndex !== null
          ? 'cursor-pointer bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:hover:bg-blue-900/60'
          : 'cursor-not-allowed bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300'
      )}
      title={nav.resolved ? `Navigate to ${displayText}` : nav.reason}
    >
      <FileCode className="h-3 w-3" />
      <span className="truncate max-w-[100px]">{displayText}</span>
      {nav.fileIndex === null && <HelpCircle className="h-3 w-3" />}
    </button>
  );
}

function DiffView({ patch, focusedLine }: { patch: string; focusedLine?: number | null }) {
  const lines = patch.split('\n');
  const lineKeys = buildDiffLineKeys(lines);
  const focusedRef = useRef<HTMLDivElement>(null);

  // Scroll the highlighted line into view once after the diff is shown.
  useEffect(() => {
    if (focusedLine != null && focusedRef.current) {
      focusedRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [focusedLine]);

  // Walk hunk headers to find which rendered row corresponds to focusedLine.
  const highlightedRows = new Set<number>();

  if (focusedLine != null) {
    let hunkBase = 0;
    let offset = 0;
    for (let i = 0; i < lines.length; i++) {
      const hunkMatch = lines[i].match(/^@@ -(\d+)/);
      if (hunkMatch) {
        hunkBase = parseInt(hunkMatch[1], 10);
        offset = 0;
        continue;
      }
      // Only context and addition lines advance the "new file" line counter.
      if (!lines[i].startsWith('-')) {
        offset++;
        if (hunkBase + offset - 1 === focusedLine) {
          highlightedRows.add(i);
        }
      }
    }
  }

  return (
    <div className="font-mono text-xs overflow-x-auto">
      {lines.map((line, i) => {
        let lineClass = 'diff-context';
        if (line.startsWith('+') && !line.startsWith('+++')) lineClass = 'diff-add';
        else if (line.startsWith('-') && !line.startsWith('---')) lineClass = 'diff-remove';
        else if (line.startsWith('@@')) lineClass = 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30';

        const isFocused = highlightedRows.has(i);

        return (
          <div
            key={lineKeys[i]}
            ref={isFocused ? focusedRef : undefined}
            className={cn(
              'px-3 py-0.5 whitespace-pre',
              lineClass,
              isFocused && 'ring-1 ring-inset ring-yellow-400 bg-yellow-50 dark:bg-yellow-900/30'
            )}
          >
            {line || ' '}
          </div>
        );
      })}
    </div>
  );
}

function FileItem({
  file,
  highlighted,
  defaultExpanded,
  focusedLine,
}: {
  file: PRFile;
  highlighted?: boolean;
  defaultExpanded?: boolean;
  focusedLine?: number | null;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded ?? false);

  return (
    <div
      className={cn(
        'border rounded-md overflow-hidden transition-colors',
        highlighted ? 'border-blue-400 dark:border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800' : 'border-border'
      )}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2 text-left',
          highlighted ? 'bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-950/50' : 'bg-muted/50 hover:bg-muted',
          'transition-colors',
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
              <DiffView patch={file.patch} focusedLine={highlighted ? focusedLine : null} />
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

interface SummaryPanels {
  orientation: string;
  focusAreas: string[];
}

function parseSummaryPanels(content: string): SummaryPanels {
  const normalized = content.replace(/\r\n/g, '\n').trim();
  const focusHeadingMatch = /^#{1,6}\s+Focus Areas\s*$/im.exec(normalized);

  if (!focusHeadingMatch || focusHeadingMatch.index === undefined) {
    return {
      orientation: normalized,
      focusAreas: [],
    };
  }

  const headingStart = focusHeadingMatch.index;
  const headingText = focusHeadingMatch[0] ?? '';
  const headingEnd = headingStart + headingText.length;
  const orientation = normalized.slice(0, headingStart).trim();
  const focusAreaBlock = normalized.slice(headingEnd).trim();

  if (!focusAreaBlock) {
    return {
      orientation,
      focusAreas: [],
    };
  }

  const focusAreas: string[] = [];
  const lines = focusAreaBlock.split('\n');
  let current: string[] = [];

  for (const line of lines) {
    if (/^\s*-\s+/.test(line)) {
      if (current.length > 0) {
        focusAreas.push(current.join('\n').trim());
      }
      current = [line.replace(/^\s*-\s+/, '')];
      continue;
    }

    if (current.length > 0) {
      current.push(line);
    }
  }

  if (current.length > 0) {
    focusAreas.push(current.join('\n').trim());
  }

  return {
    orientation,
    focusAreas,
  };
}

function SummaryPanel({
  title,
  titleClassName,
  content,
  citations,
  files,
  onNavigate,
}: {
  title: string;
  titleClassName: string;
  content: string;
  citations?: DiffCitation[];
  files?: PRFile[];
  onNavigate?: (fileIndex: number) => void;
}) {
  return (
    <div className="rounded-md border border-border p-3 sm:p-4 space-y-2 bg-muted/10">
      <div className={cn('text-xs font-semibold uppercase tracking-wide', titleClassName)}>{title}</div>
      <div className="prose prose-sm dark:prose-invert max-w-none text-foreground prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-1 prose-code:text-xs">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </div>
      {citations && citations.length > 0 && files && onNavigate && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {citations.map((citation, idx) => (
            <CitationChip key={idx} citation={citation} files={files} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </div>
  );
}

function SignalsList({ title, items, tone }: { title: string; items: string[]; tone: 'danger' | 'warning' }) {
  if (items.length === 0) {
    return null;
  }

  const toneClasses =
    tone === 'danger'
      ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300'
      : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300';

  return (
    <div className={cn('rounded-md border p-3 space-y-1.5', toneClasses)}>
      <div className="text-xs font-semibold uppercase tracking-wide">{title}</div>
      <ul className="space-y-1 text-xs">
        {items.map((item) => (
          <li key={item} className="font-mono truncate">{item}</li>
        ))}
      </ul>
    </div>
  );
}

function rankStatusContexts(
  items: Array<{ context: string; state: 'pending' | 'success' | 'failure' | 'error' }>,
  state: 'pending' | 'failure' | 'error',
  limit: number
): string[] {
  return items
    .filter((item) => item.state === state)
    .map((item) => item.context)
    .sort((a, b) => a.localeCompare(b))
    .slice(0, limit);
}

export function PRViewer() {
  const dispatch = useAppDispatch();
  const { selectedPR, files, comments, reviews, summary, signals, loadingByResource, errorByResource, focusedFileIndex, focusedFileLine } =
    useAppSelector((state) => state.prs);
  const summaryEnabled = useAppSelector((state) => state.config.config.summaryEnabled);
  const [activeTab, setActiveTab] = useState<'summary' | 'signals' | 'files' | 'comments' | 'reviews'>('summary');

  useEffect(() => {
    const handleCitationNavigate = (event: Event) => {
      const detail = (event as CustomEvent).detail as { fileIndex: number; line: number | null };
      dispatch(setFocusedFile({ fileIndex: detail.fileIndex, line: detail.line }));
      setActiveTab('files');
    };

    window.addEventListener('citation-navigate', handleCitationNavigate);
    return () => window.removeEventListener('citation-navigate', handleCitationNavigate);
  }, [dispatch]);

  const handleNavigateToFile = useCallback(
    (fileIndex: number) => {
      dispatch(setFocusedFile({ fileIndex, line: null }));
      setActiveTab('files');
    },
    [dispatch]
  );

  const summaryCitations = useMemo(() => {
    if (!summary.content) return [];
    return normalizeCitationPayload(summary.content).claims.flatMap((c) => c.citations);
  }, [summary.content]);

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
    { id: 'summary' as const, label: 'Summary' },
    { id: 'signals' as const, label: 'Signals' },
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
        {activeTab === 'summary' && (
          <div className="space-y-2 animate-fade-slide-in">
            {!summaryEnabled ? (
              <EmptyState message="Summary generation is disabled in Settings." />
            ) : summary.status === 'loading' ? (
              <LoadingState label="Generating summary..." />
            ) : summary.status === 'error' ? (
              <ErrorState message={summary.error || 'Unable to generate summary'} />
            ) : summary.status === 'empty' ? (
              <EmptyState message={summary.content || 'Nothing to Summarize'} />
            ) : summary.status === 'success' && summary.content ? (
              <div className="space-y-3">
                {(() => {
                  const panels = parseSummaryPanels(summary.content);

                  return (
                    <div className="space-y-2">
                      <SummaryPanel
                        title="Orientation"
                        titleClassName="text-blue-700 dark:text-blue-300"
                        content={panels.orientation || summary.content}
                        citations={summaryCitations}
                        files={files}
                        onNavigate={handleNavigateToFile}
                      />
                      {panels.focusAreas.map((focusArea, index) => {
                        const focusCitations = summaryCitations.slice(index * 2, index * 2 + 2);
                        return (
                          <SummaryPanel
                            key={`${focusArea.slice(0, 40)}::${index}`}
                            title={`Focus Area ${index + 1}`}
                            titleClassName="text-yellow-700 dark:text-yellow-300"
                            content={focusArea}
                            citations={focusCitations}
                            files={files}
                            onNavigate={handleNavigateToFile}
                          />
                        );
                      })}
                    </div>
                  );
                })()}
                {summary.generatedAt && (
                  <div className="text-xs text-muted-foreground text-right">
                    Generated {formatDate(new Date(summary.generatedAt).toISOString())}
                  </div>
                )}
              </div>
            ) : (
              <EmptyState message="Summary will appear after PR data loads." />
            )}
          </div>
        )}

        {activeTab === 'signals' && (
          <div className="space-y-3 animate-fade-slide-in">
            {signals.status === 'loading' ? (
              <LoadingState label="Loading CI and scanning signals..." />
            ) : signals.status === 'error' ? (
              <ErrorState message={signals.error || 'Unable to load signals'} />
            ) : !signals.data ? (
              <EmptyState message="Signal data will appear after PR data loads." />
            ) : (
              (() => {
                const failingChecks = rankAndCapFailingChecks(signals.data.checks.items, 5).map(
                  (check) => `${check.name} (${check.conclusion ?? 'unknown'})`
                );
                const pendingChecks = rankAndCapPendingChecks(signals.data.checks.items, 5).map(
                  (check) => check.name
                );
                const failingStatuses = [
                  ...rankStatusContexts(signals.data.statuses.statuses, 'failure', 5),
                  ...rankStatusContexts(signals.data.statuses.statuses, 'error', 5),
                ].slice(0, 5);
                const pendingStatuses = rankStatusContexts(signals.data.statuses.statuses, 'pending', 5);
                const topAlerts = rankAndCapScanningAlerts(signals.data.scanning.items, 5).map(
                  (alert) => `${alert.ruleId} @ ${alert.location} (${alert.severity})`
                );

                return (
                  <>
                    <div className="rounded-md border border-border bg-muted/10 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                          <ShieldAlert className="h-4 w-4" />
                          <span>Signal Overview</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          Head SHA {signals.data.headSha.slice(0, 8)}
                        </span>
                      </div>
                    </div>

                    <div className="grid gap-2 md:grid-cols-3">
                      <div className="rounded-md border border-border p-3 space-y-2">
                        <div className="text-xs font-semibold uppercase tracking-wide text-foreground">Checks</div>
                        {signals.data.checks.sourceState === 'unavailable' ? (
                          <p className="text-xs text-muted-foreground">Unavailable (not confirmed passing)</p>
                        ) : signals.data.checks.sourceState === 'error' ? (
                          <p className="text-xs text-muted-foreground">Error loading checks (not confirmed passing)</p>
                        ) : signals.data.checks.sourceState === 'ok-empty' ? (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>No check runs configured</span>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-3 text-xs">
                              <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400">
                                <XCircle className="h-3.5 w-3.5" />
                                {signals.data.checks.failing} failing
                              </span>
                              <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                                <Clock3 className="h-3.5 w-3.5" />
                                {signals.data.checks.pending} pending
                              </span>
                            </div>
                            <SignalsList title="Failing checks" items={failingChecks} tone="danger" />
                            <SignalsList title="Pending checks" items={pendingChecks} tone="warning" />
                          </>
                        )}
                      </div>

                      <div className="rounded-md border border-border p-3 space-y-2">
                        <div className="text-xs font-semibold uppercase tracking-wide text-foreground">Commit Statuses</div>
                        {signals.data.statuses.sourceState === 'unavailable' ? (
                          <p className="text-xs text-muted-foreground">Unavailable (not confirmed passing)</p>
                        ) : signals.data.statuses.sourceState === 'error' ? (
                          <p className="text-xs text-muted-foreground">Error loading statuses (not confirmed passing)</p>
                        ) : signals.data.statuses.sourceState === 'ok-empty' ? (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>No commit statuses reported</span>
                          </div>
                        ) : (
                          <>
                            <div className="text-xs text-muted-foreground">
                              Aggregate state: <span className="font-medium text-foreground">{signals.data.statuses.state ?? 'unknown'}</span>
                            </div>
                            <SignalsList title="Failing statuses" items={failingStatuses} tone="danger" />
                            <SignalsList title="Pending statuses" items={pendingStatuses} tone="warning" />
                          </>
                        )}
                      </div>

                      <div className="rounded-md border border-border p-3 space-y-2">
                        <div className="text-xs font-semibold uppercase tracking-wide text-foreground">Code Scanning</div>
                        {signals.data.scanning.sourceState === 'unavailable' ? (
                          <p className="text-xs text-muted-foreground">Unavailable (not confirmed passing)</p>
                        ) : signals.data.scanning.sourceState === 'error' ? (
                          <p className="text-xs text-muted-foreground">Error loading code scanning (not confirmed passing)</p>
                        ) : signals.data.scanning.sourceState === 'ok-empty' ? (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>No open alerts</span>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-3 text-xs">
                              <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400">
                                <XCircle className="h-3.5 w-3.5" />
                                {signals.data.scanning.openAlerts} open
                              </span>
                              <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                                <ShieldAlert className="h-3.5 w-3.5" />
                                {signals.data.scanning.highSeverityCount} critical/high
                              </span>
                            </div>
                            <SignalsList title="Top alerts" items={topAlerts} tone="danger" />
                          </>
                        )}
                      </div>
                    </div>
                  </>
                );
              })()
            )}
          </div>
        )}

        {activeTab === 'files' && (
          <div className="space-y-2 animate-fade-slide-in">
            {loadingByResource.files ? (
              <LoadingState label="Loading changed files..." />
            ) : errorByResource.files ? (
              <ErrorState message={errorByResource.files} />
            ) : files.length === 0 ? (
              <EmptyState message="No files changed in this pull request." />
            ) : (
              files.map((file, index) => (
                <FileItem
                  key={file.sha + file.filename}
                  file={file}
                  highlighted={focusedFileIndex === index}
                  defaultExpanded={focusedFileIndex === index}
                  focusedLine={focusedFileIndex === index ? focusedFileLine : null}
                />
              ))
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
