import { useEffect, useRef, useCallback, useState, lazy, Suspense } from 'react';
import { Send, Trash2, Loader2, AlertCircle, FileCode, HelpCircle } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  addMessage,
  appendStreamingContent,
  setStreaming,
  clearMessages,
  finalizeStreamingMessage,
  markMessageError,
  setMessageCitations,
} from '../store/slices/chatSlice';
import { createLLMService } from '../services/llm';
import { dummyPRContext } from '../services/dummyData';
import { normalizeCitationPayload, resolveCitationForNavigation } from '../services/citations';
import { cn, generateId } from '../lib/utils';
import type { ChatMessage, PRContext, DiffCitation } from '../types';

const AssistantMarkdown = lazy(() => import('./AssistantMarkdown'));

interface CitationChipProps {
  citation: DiffCitation;
  onNavigate: (fileIndex: number | null, line: number | null, resolved: boolean) => void;
  files: PRContext['files'];
}

function CitationChip({ citation, onNavigate, files }: CitationChipProps) {
  const nav = resolveCitationForNavigation(citation, files);
  const displayText = citation.lineStart
    ? citation.lineEnd
      ? `${citation.file}#${citation.lineStart}-${citation.lineEnd}`
      : `${citation.file}#${citation.lineStart}`
    : citation.file;

  return (
    <button
      onClick={() => onNavigate(nav.fileIndex, nav.line, nav.resolved)}
      className={cn(
        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-mono',
        'transition-colors cursor-pointer',
        nav.resolved
          ? 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:hover:bg-blue-900/60'
          : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-300 dark:hover:bg-yellow-900/60'
      )}
      title={nav.resolved ? `Navigate to ${displayText}` : nav.reason}
    >
      <FileCode className="h-3 w-3" />
      <span className="truncate max-w-[120px]">{displayText}</span>
      {!nav.resolved && <HelpCircle className="h-3 w-3" />}
    </button>
  );
}

function UncitedIndicator() {
  return (
    <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-muted text-muted-foreground">
      <HelpCircle className="h-3 w-3" />
      <span>uncited</span>
    </div>
  );
}

interface MessageBubbleProps {
  message: ChatMessage;
  files: PRContext['files'];
  onNavigate: (fileIndex: number | null, line: number | null, resolved: boolean) => void;
}

function MessageBubble({ message, files, onNavigate }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}>
      {/* Avatar */}
      <div
        className={cn(
          'flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-muted-foreground border border-border'
        )}
      >
        {isUser ? 'U' : 'AI'}
      </div>

      {/* Message content */}
      <div className="flex flex-col gap-1 max-w-[80%]">
        <div
          className={cn(
            'rounded-lg px-4 py-3 text-sm',
            isUser
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-foreground border border-border'
          )}
        >
          {message.error ? (
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{message.error}</span>
            </div>
          ) : isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <Suspense
              fallback={
                <div className="space-y-2 min-w-[180px]" aria-live="polite">
                  <p className="text-xs text-muted-foreground">Rendering response...</p>
                  <div className="h-2.5 w-full rounded bg-muted/70 animate-pulse" />
                  <div className="h-2.5 w-4/5 rounded bg-muted/70 animate-pulse" />
                </div>
              }
            >
              <AssistantMarkdown content={message.content} isStreaming={message.isStreaming} />
            </Suspense>
          )}
        </div>
        {!isUser && !message.isStreaming && (message.citations || message.hasUncitedContent) && (
          <div className="flex flex-wrap items-center gap-1.5 px-1">
            {message.citations?.map((citation, idx) => (
              <CitationChip key={idx} citation={citation} onNavigate={onNavigate} files={files} />
            ))}
            {message.hasUncitedContent && <UncitedIndicator />}
          </div>
        )}
      </div>
    </div>
  );
}

export function ChatWindow() {
  const dispatch = useAppDispatch();
  const { messages, isStreaming } = useAppSelector((state) => state.chat);
  const config = useAppSelector((state) => state.config.config);
  const selectedPR = useAppSelector((state) => state.prs.selectedPR);
  const prFiles = useAppSelector((state) => state.prs.files);
  const prComments = useAppSelector((state) => state.prs.comments);
  const prReviewComments = useAppSelector((state) => state.prs.reviewComments);
  const prReviews = useAppSelector((state) => state.prs.reviews);
  const prSignals = useAppSelector((state) => state.prs.signals.data);

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previousSelectedPRIdRef = useRef<number | null>(null);
  const activeStreamAbortRef = useRef<AbortController | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    const abortController = activeStreamAbortRef.current;
    const currentPRId = selectedPR?.id ?? null;
    if (previousSelectedPRIdRef.current !== currentPRId) {
      abortController?.abort();
      activeStreamAbortRef.current = null;
    }

    if (
      previousSelectedPRIdRef.current !== null &&
      currentPRId !== null &&
      previousSelectedPRIdRef.current !== currentPRId
    ) {
      dispatch(clearMessages());
    }
    previousSelectedPRIdRef.current = currentPRId;
  }, [dispatch, selectedPR?.id]);

  useEffect(() => {
    return () => {
      activeStreamAbortRef.current?.abort();
      activeStreamAbortRef.current = null;
    };
  }, []);

  const getPRContext = useCallback((): PRContext => {
    if (config.demoMode) {
      return dummyPRContext;
    }
    if (selectedPR) {
      return {
        pr: selectedPR,
        files: prFiles,
        comments: prComments,
        reviewComments: prReviewComments,
        reviews: prReviews,
      };
    }
    return dummyPRContext;
  }, [config.demoMode, selectedPR, prFiles, prComments, prReviewComments, prReviews]);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;

    setInput('');

    // Add user message
    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: trimmed,
      timestamp: Date.now(),
    };
    dispatch(addMessage(userMessage));

    // Create assistant message placeholder
    const assistantId = generateId();
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isStreaming: true,
    };
    dispatch(addMessage(assistantMessage));
    dispatch(setStreaming({ isStreaming: true, messageId: assistantId }));

    // Declared outside try so the abort-catch path can also dispatch citations.
    let fullContent = '';

    const dispatchCitations = (content: string) => {
      const parseResult = normalizeCitationPayload(content);
      dispatch(
        setMessageCitations({
          id: assistantId,
          citations: parseResult.claims.flatMap((c) => c.citations),
          hasUncitedContent: parseResult.uncitedText.length > 0,
        })
      );
    };

    try {
      activeStreamAbortRef.current?.abort();
      const abortController = new AbortController();
      activeStreamAbortRef.current = abortController;

      const llmService = createLLMService(config);
      const prContext = getPRContext();
      const systemPrompt = llmService.buildSystemPrompt(prContext, prSignals);

      // Build message history for LLM.
      // Keep only the most recent turns to avoid exceeding the model's context
      // window. The system prompt already embeds the full PR diff, so the
      // combined token count can be large even with a short history.
      const MAX_HISTORY_TURNS = 20;
      const llmMessages = [
        { role: 'system' as const, content: systemPrompt },
        ...messages
          .filter((m) => m.role !== 'system' && !m.error && !m.isStreaming)
          .slice(-MAX_HISTORY_TURNS)
          .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        { role: 'user' as const, content: trimmed },
      ];

      // Stream the response.
      for await (const chunk of llmService.chatStream(llmMessages, { signal: abortController.signal })) {
        fullContent += chunk;
        dispatch(appendStreamingContent({ id: assistantId, chunk }));
      }

      if (fullContent.trim().length === 0) {
        const fallbackContent = await llmService.chat(llmMessages, { signal: abortController.signal });
        if (fallbackContent) {
          fullContent = fallbackContent;
          dispatch(appendStreamingContent({ id: assistantId, chunk: fallbackContent }));
        }
      }

      dispatch(finalizeStreamingMessage(assistantId));
      dispatchCitations(fullContent);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        dispatch(finalizeStreamingMessage(assistantId));
        dispatchCitations(fullContent);
        return;
      }

      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      dispatch(markMessageError({ id: assistantId, error: errorMessage }));
    } finally {
      activeStreamAbortRef.current = null;
    }
  }, [input, isStreaming, dispatch, config, messages, getPRContext, prSignals]); // messages still needed for history building

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const handleClear = () => {
    dispatch(clearMessages());
  };

  const handleCitationNavigate = useCallback(
    (fileIndex: number | null, line: number | null, resolved: boolean) => {
      if (!resolved || fileIndex === null) {
        return;
      }
      // Emit event for PRViewer to handle navigation
      const event = new CustomEvent('citation-navigate', {
        detail: { fileIndex, line },
      });
      window.dispatchEvent(event);
    },
    []
  );

  const prContext = getPRContext();

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            {config.demoMode ? 'Demo Mode' : selectedPR ? `PR #${selectedPR.number}` : 'Chat'}
          </h2>
          <p className="text-xs text-muted-foreground">
            {config.demoMode
              ? `Reviewing: ${prContext.pr.title}`
              : selectedPR
              ? selectedPR.title
              : 'Select a PR to start reviewing'}
          </p>
        </div>
        <button
          onClick={handleClear}
          disabled={messages.length === 0}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs',
            'text-muted-foreground hover:text-foreground hover:bg-accent',
            'transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
          )}
          title="Clear conversation"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Clear
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <span className="text-2xl">🤖</span>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">PR Review Assistant</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                Ask me anything about this PR — code changes, potential issues, suggestions, or explanations.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center mt-2">
              {[
                'Summarize this PR',
                'What are the security implications?',
                'Are there any potential bugs?',
                'Explain the authentication flow',
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setInput(suggestion)}
                  className={cn(
                    'text-xs px-3 py-1.5 rounded-full border border-border',
                    'text-muted-foreground hover:text-foreground hover:bg-accent',
                    'transition-colors'
                  )}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            files={prFiles}
            onNavigate={handleCitationNavigate}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 border-t border-border p-4">
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about this PR... (Enter to send, Shift+Enter for new line)"
            rows={1}
            disabled={isStreaming}
            className={cn(
              'flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm',
              'placeholder:text-muted-foreground',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
              'transition-colors disabled:opacity-50',
              'min-h-[40px] max-h-[120px]'
            )}
            style={{
              height: 'auto',
              overflowY: input.split('\n').length > 3 ? 'auto' : 'hidden',
            }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
            }}
          />
          <button
            onClick={() => void handleSend()}
            disabled={!input.trim() || isStreaming}
            className={cn(
              'flex-shrink-0 rounded-md p-2 h-10 w-10',
              'bg-primary text-primary-foreground',
              'hover:bg-primary/90',
              'transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
              'flex items-center justify-center'
            )}
            title="Send message"
          >
            {isStreaming ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-1.5">
          {config.demoMode
            ? '🎭 Demo mode — using sample PR data'
            : `Using ${config.llmModel} via ${config.llmBackend}`}
        </p>
      </div>
    </div>
  );
}
