import { describe, it, expect } from 'vitest';
import chatReducer, {
  addMessage,
  updateStreamingMessage,
  appendStreamingContent,
  finalizeStreamingMessage,
  setStreaming,
  setError,
  clearMessages,
  markMessageError,
  setMessageCitations,
} from './chatSlice';
import type { ChatMessage } from '../../types';

function makeMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'msg-1',
    role: 'user',
    content: 'Hello',
    timestamp: 1000,
    ...overrides,
  };
}

const emptyState = {
  messages: [],
  isStreaming: false,
  streamingMessageId: null,
  error: null,
};

describe('chatSlice', () => {
  describe('addMessage', () => {
    it('appends a message to the list', () => {
      const msg = makeMessage();
      const next = chatReducer(emptyState, addMessage(msg));
      expect(next.messages).toHaveLength(1);
      expect(next.messages[0]).toEqual(msg);
    });
  });

  describe('updateStreamingMessage', () => {
    it('replaces the content of the matching message', () => {
      const state = {
        ...emptyState,
        messages: [makeMessage({ id: 'a', content: 'old' })],
      };
      const next = chatReducer(state, updateStreamingMessage({ id: 'a', content: 'new' }));
      expect(next.messages[0].content).toBe('new');
    });

    it('does nothing when id does not match', () => {
      const state = {
        ...emptyState,
        messages: [makeMessage({ id: 'a', content: 'old' })],
      };
      const next = chatReducer(state, updateStreamingMessage({ id: 'z', content: 'new' }));
      expect(next.messages[0].content).toBe('old');
    });
  });

  describe('appendStreamingContent', () => {
    it('appends a chunk to the matching message content', () => {
      const state = {
        ...emptyState,
        messages: [makeMessage({ id: 'a', content: 'Hello' })],
      };
      const next = chatReducer(state, appendStreamingContent({ id: 'a', chunk: ' world' }));
      expect(next.messages[0].content).toBe('Hello world');
    });
  });

  describe('finalizeStreamingMessage', () => {
    it('sets isStreaming=false on the message and clears streaming state', () => {
      const state = {
        messages: [makeMessage({ id: 'a', isStreaming: true })],
        isStreaming: true,
        streamingMessageId: 'a',
        error: null,
      };
      const next = chatReducer(state, finalizeStreamingMessage('a'));
      expect(next.messages[0].isStreaming).toBe(false);
      expect(next.isStreaming).toBe(false);
      expect(next.streamingMessageId).toBeNull();
    });
  });

  describe('setStreaming', () => {
    it('sets isStreaming and streamingMessageId', () => {
      const next = chatReducer(emptyState, setStreaming({ isStreaming: true, messageId: 'x' }));
      expect(next.isStreaming).toBe(true);
      expect(next.streamingMessageId).toBe('x');
    });

    it('clears streamingMessageId when messageId is omitted', () => {
      const state = { ...emptyState, isStreaming: true, streamingMessageId: 'x' };
      const next = chatReducer(state, setStreaming({ isStreaming: false }));
      expect(next.isStreaming).toBe(false);
      expect(next.streamingMessageId).toBeNull();
    });
  });

  describe('setError', () => {
    it('sets the error and stops streaming', () => {
      const state = { ...emptyState, isStreaming: true, streamingMessageId: 'x' };
      const next = chatReducer(state, setError('Something went wrong'));
      expect(next.error).toBe('Something went wrong');
      expect(next.isStreaming).toBe(false);
      expect(next.streamingMessageId).toBeNull();
    });

    it('clears the error when null is passed', () => {
      const state = { ...emptyState, error: 'old error' };
      const next = chatReducer(state, setError(null));
      expect(next.error).toBeNull();
    });
  });

  describe('clearMessages', () => {
    it('resets all state to initial values', () => {
      const state = {
        messages: [makeMessage()],
        isStreaming: true,
        streamingMessageId: 'x',
        error: 'oops',
      };
      const next = chatReducer(state, clearMessages());
      expect(next.messages).toHaveLength(0);
      expect(next.isStreaming).toBe(false);
      expect(next.streamingMessageId).toBeNull();
      expect(next.error).toBeNull();
    });
  });

  describe('markMessageError', () => {
    it('marks the message with an error and stops streaming', () => {
      const state = {
        messages: [makeMessage({ id: 'a', isStreaming: true })],
        isStreaming: true,
        streamingMessageId: 'a',
        error: null,
      };
      const next = chatReducer(state, markMessageError({ id: 'a', error: 'API failed' }));
      expect(next.messages[0].isStreaming).toBe(false);
      expect(next.messages[0].error).toBe('API failed');
      expect(next.isStreaming).toBe(false);
      expect(next.streamingMessageId).toBeNull();
    });
  });

  describe('setMessageCitations', () => {
    it('sets citations on an assistant message', () => {
      const state = {
        ...emptyState,
        messages: [makeMessage({ id: 'a', role: 'assistant', content: 'Test' })],
      };
      const citations = [{ file: 'src/auth.ts', lineStart: 10 }];
      const next = chatReducer(state, setMessageCitations({
        id: 'a',
        citations,
        hasUncitedContent: false,
      }));
      expect(next.messages[0].citations).toEqual(citations);
      expect(next.messages[0].hasUncitedContent).toBe(false);
    });

    it('does not set citations on user messages', () => {
      const state = {
        ...emptyState,
        messages: [makeMessage({ id: 'a', role: 'user', content: 'Test' })],
      };
      const citations = [{ file: 'src/auth.ts' }];
      const next = chatReducer(state, setMessageCitations({
        id: 'a',
        citations,
        hasUncitedContent: true,
      }));
      expect(next.messages[0].citations).toBeUndefined();
    });

    it('marks hasUncitedContent correctly', () => {
      const state = {
        ...emptyState,
        messages: [makeMessage({ id: 'a', role: 'assistant', content: 'Test' })],
      };
      const next = chatReducer(state, setMessageCitations({
        id: 'a',
        citations: [],
        hasUncitedContent: true,
      }));
      expect(next.messages[0].hasUncitedContent).toBe(true);
    });
  });
});
