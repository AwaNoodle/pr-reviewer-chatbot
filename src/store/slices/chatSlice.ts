import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { ChatMessage, DiffCitation } from '../../types';

interface ChatState {
  messages: ChatMessage[];
  isStreaming: boolean;
  streamingMessageId: string | null;
  error: string | null;
}

const initialState: ChatState = {
  messages: [],
  isStreaming: false,
  streamingMessageId: null,
  error: null,
};

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    addMessage(state, action: PayloadAction<ChatMessage>) {
      state.messages.push(action.payload);
    },
    updateStreamingMessage(state, action: PayloadAction<{ id: string; content: string }>) {
      const message = state.messages.find((m) => m.id === action.payload.id);
      if (message) {
        message.content = action.payload.content;
      }
    },
    appendStreamingContent(state, action: PayloadAction<{ id: string; chunk: string }>) {
      const message = state.messages.find((m) => m.id === action.payload.id);
      if (message) {
        message.content += action.payload.chunk;
      }
    },
    finalizeStreamingMessage(state, action: PayloadAction<string>) {
      const message = state.messages.find((m) => m.id === action.payload);
      if (message) {
        message.isStreaming = false;
      }
      state.isStreaming = false;
      state.streamingMessageId = null;
    },
    setStreaming(state, action: PayloadAction<{ isStreaming: boolean; messageId?: string }>) {
      state.isStreaming = action.payload.isStreaming;
      state.streamingMessageId = action.payload.messageId ?? null;
    },
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
      state.isStreaming = false;
      state.streamingMessageId = null;
    },
    clearMessages(state) {
      state.messages = [];
      state.isStreaming = false;
      state.streamingMessageId = null;
      state.error = null;
    },
    markMessageError(state, action: PayloadAction<{ id: string; error: string }>) {
      const message = state.messages.find((m) => m.id === action.payload.id);
      if (message) {
        message.isStreaming = false;
        message.error = action.payload.error;
      }
      state.isStreaming = false;
      state.streamingMessageId = null;
    },
    setMessageCitations(state, action: PayloadAction<{ id: string; citations: DiffCitation[]; hasUncitedContent: boolean }>) {
      const message = state.messages.find((m) => m.id === action.payload.id);
      if (message && message.role === 'assistant') {
        message.citations = action.payload.citations;
        message.hasUncitedContent = action.payload.hasUncitedContent;
      }
    },
  },
});

export const {
  addMessage,
  updateStreamingMessage,
  appendStreamingContent,
  finalizeStreamingMessage,
  setStreaming,
  setError,
  clearMessages,
  markMessageError,
  setMessageCitations,
} = chatSlice.actions;

export default chatSlice.reducer;
