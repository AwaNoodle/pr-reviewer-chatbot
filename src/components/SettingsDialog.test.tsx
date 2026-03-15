import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SettingsDialog } from './SettingsDialog';
import configReducer, { DEFAULT_SUMMARY_PROMPT } from '../store/slices/configSlice';
import prsReducer from '../store/slices/prsSlice';
import chatReducer from '../store/slices/chatSlice';

function renderDialog() {
  const store = configureStore({
    reducer: {
      config: configReducer,
      prs: prsReducer,
      chat: chatReducer,
    },
    preloadedState: {
      config: {
        config: {
          githubPat: '',
          llmApiKey: '',
          githubInstance: 'github.com',
          llmBackend: 'openai' as const,
          llmEndpoint: 'https://api.openai.com/v1',
          llmModel: 'gpt-4o',
          demoMode: false,
          summaryEnabled: true,
          summaryPrompt: 'Custom summary prompt',
          summaryCommands: 'Keep command A',
        },
      },
    },
  });

  render(
    <Provider store={store}>
      <SettingsDialog />
    </Provider>
  );

  return store;
}

describe('SettingsDialog summary controls', () => {
  it('shows summary controls and saves updates', () => {
    const store = renderDialog();
    fireEvent.click(screen.getByRole('button', { name: /settings/i }));

    const summaryPromptInput = screen.getByLabelText('Summary Prompt');
    const summaryCommandsInput = screen.getByLabelText('Additional Summary Commands');
    const summaryToggle = screen.getAllByRole('switch')[1];

    fireEvent.change(summaryPromptInput, { target: { value: 'Updated prompt text' } });
    fireEvent.change(summaryCommandsInput, { target: { value: 'Updated commands' } });
    fireEvent.click(summaryToggle);

    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    const config = store.getState().config.config;
    expect(config.summaryPrompt).toBe('Updated prompt text');
    expect(config.summaryCommands).toBe('Updated commands');
    expect(config.summaryEnabled).toBe(false);
  });

  it('reset summary prompt button does not reset additional commands', () => {
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: /settings/i }));

    const summaryPromptInput = screen.getByLabelText('Summary Prompt') as HTMLTextAreaElement;
    const summaryCommandsInput = screen.getByLabelText('Additional Summary Commands') as HTMLTextAreaElement;

    expect(summaryPromptInput.value).toBe('Custom summary prompt');
    expect(summaryCommandsInput.value).toBe('Keep command A');

    fireEvent.click(screen.getByRole('button', { name: 'Reset Summary Prompt' }));

    expect(summaryPromptInput.value).toBe(DEFAULT_SUMMARY_PROMPT);
    expect(summaryCommandsInput.value).toBe('Keep command A');
  });
});
