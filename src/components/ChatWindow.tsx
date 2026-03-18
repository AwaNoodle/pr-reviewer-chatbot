import { useEffect, useRef, useCallback } from 'react';
import { Send, Trash2, Loader2, AlertCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  addMessage,
  appendStreamingContent,
  setStreaming,
  clearMessages,
  finalizeStreamingMessage,
  markMessageError,
} from '../store/slices/chatSlice';
import { createLLMService } from '../services/llm';
import { dummyPRContext } from '../services/dummyData';
import { cn, generateId } from '../lib/utils';
import type { ChatMessage, PRContext } from '../types';
import { useState } from 'react';

interface MessageBubbleProps {
  message: ChatMessage;
}

function MessageBubble({ message }: MessageBubbleProps) {
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
      <div
        className={cn(
          'max-w-[80%] rounded-lg px-4 py-3 text-sm',
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
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className ?? '');
                  const isInline = !match;
                  return isInline ? (
                    <code
                      className="bg-background/50 rounded px-1 py-0.5 font-mono text-xs"
                      {...props}
                    >
                      {children}
                    </code>
                  ) : (
                    <SyntaxHighlighter
                      style={oneDark}
                      language={match[1]}
                      PreTag="div"
                      className="rounded-md text-xs"
                    >
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  );
                },
              }}
            >
              {message.content}
            </ReactMarkdown>
            {message.isStreaming && (
              <span className="inline-block w-1.5 h-4 bg-current animate-pulse ml-0.5" />
            )}
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

    try {
      activeStreamAbortRef.current?.abort();
      const abortController = new AbortController();
      activeStreamAbortRef.current = abortController;

      const llmService = createLLMService(config);
      const prContext = getPRContext();
      const systemPrompt = llmService.buildSystemPrompt(prContext);

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

      // Stream the response
      for await (const chunk of llmService.chatStream(llmMessages, { signal: abortController.signal })) {
        dispatch(appendStreamingContent({ id: assistantId, chunk }));
      }

      dispatch(finalizeStreamingMessage(assistantId));
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        dispatch(finalizeStreamingMessage(assistantId));
        return;
      }

      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      dispatch(markMessageError({ id: assistantId, error: errorMessage }));
    } finally {
      activeStreamAbortRef.current = null;
    }
  }, [input, isStreaming, dispatch, config, messages, getPRContext]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const handleClear = () => {
    dispatch(clearMessages());
  };

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
          <MessageBubble key={message.id} message={message} />
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
