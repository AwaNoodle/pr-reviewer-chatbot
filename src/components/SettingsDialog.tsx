import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Settings, X } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { DEFAULT_SUMMARY_PROMPT, updateConfig } from '../store/slices/configSlice';
import type { AppConfig } from '../types';
import { cn } from '../lib/utils';

interface FieldProps {
  label: string;
  id: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  description?: string;
}

interface TextareaFieldProps {
  label: string;
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  description?: string;
  rows?: number;
}

function Field({ label, id, type = 'text', value, onChange, placeholder, description }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          'w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
          'placeholder:text-muted-foreground',
          'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
          'transition-colors'
        )}
      />
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  );
}

function TextareaField({ label, id, value, onChange, placeholder, description, rows = 4 }: TextareaFieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className={cn(
          'w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
          'placeholder:text-muted-foreground',
          'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
          'transition-colors resize-y'
        )}
      />
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
    </div>
  );
}

export function SettingsDialog() {
  const dispatch = useAppDispatch();
  const config = useAppSelector((state) => state.config.config);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<AppConfig>(config);

  const handleOpen = () => {
    setForm(config);
    setOpen(true);
  };

  const handleSave = () => {
    dispatch(updateConfig(form));
    setOpen(false);
  };

  const handleCancel = () => {
    setForm(config);
    setOpen(false);
  };

  const updateField = (field: keyof AppConfig) => (value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleResetSummaryPrompt = () => {
    setForm((prev) => ({ ...prev, summaryPrompt: DEFAULT_SUMMARY_PROMPT }));
  };

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && handleCancel()}>
      <Dialog.Trigger asChild>
        <button
          onClick={handleOpen}
          className={cn(
            'flex items-center gap-2 rounded-md px-3 py-2 text-sm',
            'text-muted-foreground hover:text-foreground hover:bg-accent',
            'transition-colors'
          )}
          title="Settings"
        >
          <Settings className="h-4 w-4" />
          <span>Settings</span>
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className={cn(
            'fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%]',
            'w-full max-w-lg max-h-[90vh] overflow-y-auto',
            'rounded-lg border border-border bg-background shadow-xl',
            'p-6',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]',
            'data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]'
          )}
        >
          <div className="flex items-center justify-between mb-6">
            <Dialog.Title className="text-lg font-semibold text-foreground">
              Settings
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                onClick={handleCancel}
                className="rounded-sm opacity-70 hover:opacity-100 transition-opacity"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </button>
            </Dialog.Close>
          </div>

          <Dialog.Description className="text-sm text-muted-foreground mb-6">
            Configure GitHub access, LLM connection details, and PR summary behavior.
          </Dialog.Description>

          <div className="space-y-6">
            {/* Demo Mode Toggle */}
            <div className="flex items-center justify-between rounded-lg border border-border p-4">
              <div>
                <p className="text-sm font-medium text-foreground">Demo Mode</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Use sample PR data without GitHub credentials
                </p>
              </div>
              <button
                role="switch"
                aria-checked={form.demoMode}
                onClick={() => updateField('demoMode')(!form.demoMode)}
                className={cn(
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                  form.demoMode ? 'bg-primary' : 'bg-muted'
                )}
              >
                <span
                  className={cn(
                    'inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
                    form.demoMode ? 'translate-x-6' : 'translate-x-1'
                  )}
                />
              </button>
            </div>

            {/* GitHub Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">
                GitHub Configuration
              </h3>
              <Field
                label="Personal Access Token"
                id="github-pat"
                type="password"
                value={form.githubPat}
                onChange={updateField('githubPat')}
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                description="Required for GitHub API access. Needs repo and read:user scopes."
              />
              <Field
                label="GitHub Instance"
                id="github-instance"
                value={form.githubInstance}
                onChange={updateField('githubInstance')}
                placeholder="github.com"
                description="Use 'github.com' for GitHub.com or your GHES hostname (e.g., github.mycompany.com)"
              />
            </div>

            {/* LLM Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">
                LLM Configuration
              </h3>
              <div className="space-y-1.5">
                <label htmlFor="llm-backend" className="text-sm font-medium text-foreground">
                  Backend
                </label>
                <select
                  id="llm-backend"
                  value={form.llmBackend}
                  onChange={(e) => updateField('llmBackend')(e.target.value)}
                  className={cn(
                    'w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
                    'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
                    'transition-colors'
                  )}
                >
                  <option value="openai">OpenAI v1 API</option>
                  <option value="litellm">LiteLLM Proxy</option>
                </select>
                <p className="text-xs text-muted-foreground">
                  Both use the OpenAI v1 API format
                </p>
              </div>
              <Field
                label="API Endpoint"
                id="llm-endpoint"
                value={form.llmEndpoint}
                onChange={updateField('llmEndpoint')}
                placeholder="https://api.openai.com/v1"
                description="The base URL for the LLM API (without /chat/completions)"
              />
              <Field
                label="API Key"
                id="llm-api-key"
                type="password"
                value={form.llmApiKey}
                onChange={updateField('llmApiKey')}
                placeholder="sk-xxxxxxxxxxxxxxxxxxxx"
                description="Your LLM API key"
              />
              <Field
                label="Model"
                id="llm-model"
                value={form.llmModel}
                onChange={updateField('llmModel')}
                placeholder="gpt-4o"
                description="The model to use for chat completions"
              />
            </div>

            {/* Summary Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">
                PR Summary
              </h3>

              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div>
                  <p className="text-sm font-medium text-foreground">Enable Summary Generation</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Automatically generate a kickoff summary when loading a pull request
                  </p>
                </div>
                <button
                  role="switch"
                  aria-checked={form.summaryEnabled}
                  onClick={() => updateField('summaryEnabled')(!form.summaryEnabled)}
                  className={cn(
                    'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                    form.summaryEnabled ? 'bg-primary' : 'bg-muted'
                  )}
                >
                  <span
                    className={cn(
                      'inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
                      form.summaryEnabled ? 'translate-x-6' : 'translate-x-1'
                    )}
                  />
                </button>
              </div>

              <TextareaField
                label="Summary Prompt"
                id="summary-prompt"
                value={form.summaryPrompt}
                onChange={updateField('summaryPrompt')}
                rows={10}
                description="Editable base prompt used to generate PR kickoff summaries."
              />

              <TextareaField
                label="Additional Summary Commands"
                id="summary-commands"
                value={form.summaryCommands}
                onChange={updateField('summaryCommands')}
                rows={4}
                placeholder="Optional per-team guidance appended to summary generation"
                description="Optional extra instructions appended after the summary prompt."
              />

              <button
                onClick={handleResetSummaryPrompt}
                type="button"
                className={cn(
                  'rounded-md px-3 py-2 text-xs font-medium',
                  'border border-input bg-background text-foreground',
                  'hover:bg-accent hover:text-accent-foreground transition-colors'
                )}
              >
                Reset Summary Prompt
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border">
            <button
              onClick={handleCancel}
              className={cn(
                'rounded-md px-4 py-2 text-sm font-medium',
                'border border-input bg-background text-foreground',
                'hover:bg-accent hover:text-accent-foreground',
                'transition-colors'
              )}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className={cn(
                'rounded-md px-4 py-2 text-sm font-medium',
                'bg-primary text-primary-foreground',
                'hover:bg-primary/90',
                'transition-colors'
              )}
            >
              Save Changes
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
