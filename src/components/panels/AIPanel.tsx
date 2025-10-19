import { useState, useEffect } from 'react';
import { useWidgetStore } from '@/store/widgetStore';
import { parseNLToPlan, applyPlan } from '@/utils/nlPlanner';
import { parseNLWithAI, editSpecWithAI, type AIProvider } from '@/utils/aiService';

// Storage keys
// API keys use sessionStorage for security (cleared on browser close)
// Other preferences use localStorage for convenience
const STORAGE_KEYS = {
  AI_MODE: 'vega_widget_ai_mode',
  AI_PROVIDER: 'vega_widget_ai_provider',
  AI_API_KEY: 'vega_widget_ai_api_key', // Now in sessionStorage
  AI_MODEL: 'vega_widget_ai_model',
};

export function AIPanel() {
  const builderState = useWidgetStore((state) => state.builderState);
  const vegaSpec = useWidgetStore((state) => state.vegaSpec);
  const dataFields = useWidgetStore((state) => state.dataFields);
  const lastPlan = useWidgetStore((state) => state.lastPlan);
  const setBuilderState = useWidgetStore((state) => state.setBuilderState);
  const setSpec = useWidgetStore((state) => state.setSpec);
  const setLastPlan = useWidgetStore((state) => state.setLastPlan);
  const captureSnapshot = useWidgetStore((state) => state.captureSnapshot);

  const [command, setCommand] = useState('');
  const [mode, setMode] = useState<'regex' | 'ai'>(() => {
    return (localStorage.getItem(STORAGE_KEYS.AI_MODE) as 'regex' | 'ai') || 'regex';
  });
  const [provider, setProvider] = useState<AIProvider>(() => {
    return (localStorage.getItem(STORAGE_KEYS.AI_PROVIDER) as AIProvider) || 'openrouter';
  });
  const [apiKey, setApiKey] = useState(() => {
    // Use sessionStorage for API keys (more secure - cleared on browser close)
    return sessionStorage.getItem(STORAGE_KEYS.AI_API_KEY) || '';
  });
  const [model, setModel] = useState(() => {
    return localStorage.getItem(STORAGE_KEYS.AI_MODEL) || '';
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasAcknowledgedPrivacy, setHasAcknowledgedPrivacy] = useState(() =>
    localStorage.getItem('ai_privacy_acknowledged') === 'true'
  );

  // Persist settings to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.AI_MODE, mode);
  }, [mode]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.AI_PROVIDER, provider);
  }, [provider]);

  useEffect(() => {
    // Store API key in sessionStorage (cleared on browser close for security)
    sessionStorage.setItem(STORAGE_KEYS.AI_API_KEY, apiKey);
  }, [apiKey]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.AI_MODEL, model);
  }, [model]);

  const fieldNames = dataFields.map((f) => f.name);

  // Detect if current spec is a complex/custom spec that can't be represented in BuilderState
  const isCustomSpec = !!(
    vegaSpec.facet ||
    vegaSpec.layer ||
    vegaSpec.hconcat ||
    vegaSpec.vconcat ||
    vegaSpec.repeat ||
    (vegaSpec.transform && vegaSpec.transform.length > 3) ||
    (vegaSpec.data && (vegaSpec.data as any).url)
  );

  // Auto-switch to GenAI mode when custom spec is detected
  useEffect(() => {
    if (isCustomSpec && mode === 'regex') {
      setMode('ai');
    }
  }, [isCustomSpec, mode]);

  const handleClearApiKey = () => {
    if (window.confirm('Clear saved API key from browser storage?')) {
      setApiKey('');
      sessionStorage.removeItem(STORAGE_KEYS.AI_API_KEY);
    }
  };

  const handleApplyCommand = async () => {
    if (!command.trim()) return;

    // Privacy notice for AI features
    if (mode === 'ai' && !hasAcknowledgedPrivacy) {
      const providerName = provider === 'openrouter' ? 'OpenRouter' : provider === 'openai' ? 'OpenAI' : 'Anthropic';
      const confirmed = window.confirm(
        `⚠️ Privacy Notice\n\n` +
        `Using AI features will send your chart data (field names and types) and commands to ${providerName} for processing.\n\n` +
        `Your data will be processed according to their privacy policy. API requests are made directly from your browser.\n\n` +
        `Do you want to continue?`
      );

      if (!confirmed) return;

      localStorage.setItem('ai_privacy_acknowledged', 'true');
      setHasAcknowledgedPrivacy(true);
    }

    setError(null);

    try {
      // For GenAI mode with custom specs, use direct spec editing
      if (mode === 'ai' && isCustomSpec) {
        if (!apiKey.trim()) {
          setError('Please enter an API key');
          return;
        }

        setIsLoading(true);
        const result = await editSpecWithAI(command, vegaSpec, dataFields, {
          provider,
          apiKey,
          model: model || undefined,
        });
        setIsLoading(false);

        if (result.success && result.spec) {
          captureSnapshot(`AI: ${command}`);
          setSpec(result.spec, {});
          setLastPlan({
            intentText: command,
            confidence: 0.9,
            operations: [{ op: 'direct_spec_edit' as any, description: 'Modified spec directly with AI' }],
          });
          setCommand('');
        } else {
          setError(result.error || 'Failed to edit spec');
        }
        return;
      }

      // For regex mode with custom specs, warn user
      if (mode === 'regex' && isCustomSpec) {
        const confirmed = window.confirm(
          '⚠️ Warning: You are using a custom/complex spec.\n\n' +
          'Regex commands will regenerate the spec and LOSE customizations.\n\n' +
          'For custom specs, use GenAI mode instead. Continue anyway?'
        );
        if (!confirmed) return;
      }

      // Standard flow for simple specs or regex mode
      let plan;

      if (mode === 'regex') {
        // Use regex-based parsing
        plan = parseNLToPlan(command, fieldNames, builderState);
      } else {
        // Use GenAI for simple specs
        if (!apiKey.trim()) {
          setError('Please enter an API key');
          return;
        }

        setIsLoading(true);
        plan = await parseNLWithAI(command, fieldNames, builderState, dataFields, {
          provider,
          apiKey,
          model: model || undefined,
        });
        setIsLoading(false);
      }

      const nextState = applyPlan(builderState, plan, dataFields);

      captureSnapshot(`AI: ${command}`);
      setLastPlan(plan);
      setBuilderState(nextState);
      setCommand('');
    } catch (err) {
      setIsLoading(false);
      setError(err instanceof Error ? err.message : 'Failed to process command');
      console.error('AI command error:', err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleApplyCommand();
    }
  };

  const SUGGESTIONS = [
    'change to line chart',
    'color by Region',
    'top 10 by Sales',
    'make West blue and East orange',
    'sort by Sales descending',
    'use viridis color scheme',
  ];

  return (
    <div className="space-y-4">
      {isCustomSpec && (
        <div className="p-3 bg-blue-50 border border-blue-300 rounded">
          <div className="flex items-start gap-2">
            <span className="text-blue-600 font-bold">ℹ️</span>
            <div className="flex-1">
              <p className="text-xs font-semibold text-blue-800 mb-1">
                Custom Spec Detected
              </p>
              <p className="text-xs text-blue-700">
                Complex spec detected (faceted/layered/external data).
                {mode === 'ai'
                  ? ' GenAI mode will modify your spec directly while preserving its structure! ✨'
                  : ' Regex mode will regenerate the spec. Switch to GenAI mode for better results!'
                }
              </p>
            </div>
          </div>
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold mb-2">Natural Language Commands</h3>

        {/* Mode selector */}
        <div className="mb-3 flex gap-2">
          <button
            onClick={() => setMode('regex')}
            disabled={isCustomSpec}
            className={`px-3 py-1.5 text-xs font-medium rounded ${
              mode === 'regex'
                ? 'bg-blue-600 text-white'
                : isCustomSpec
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            title={isCustomSpec ? 'Regex mode disabled for custom specs - use GenAI mode' : 'Use pattern matching (works offline)'}
          >
            Regex (Free) {isCustomSpec && '🔒'}
          </button>
          <button
            onClick={() => setMode('ai')}
            className={`px-3 py-1.5 text-xs font-medium rounded ${
              mode === 'ai'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            title="Use AI for better natural language understanding"
          >
            GenAI (Requires API Key) {isCustomSpec && '✨'}
          </button>
        </div>

        {/* AI configuration */}
        {mode === 'ai' && (
          <div className="mb-3 p-3 bg-gray-50 border border-gray-200 rounded space-y-2">
            <div>
              <label className="block text-xs font-medium mb-1">Provider</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setProvider('openrouter')}
                  className={`px-2 py-1 text-xs rounded ${
                    provider === 'openrouter'
                      ? 'bg-green-600 text-white'
                      : 'bg-white border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  OpenRouter
                </button>
                <button
                  onClick={() => setProvider('openai')}
                  className={`px-2 py-1 text-xs rounded ${
                    provider === 'openai'
                      ? 'bg-green-600 text-white'
                      : 'bg-white border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  OpenAI
                </button>
                <button
                  onClick={() => setProvider('anthropic')}
                  className={`px-2 py-1 text-xs rounded ${
                    provider === 'anthropic'
                      ? 'bg-green-600 text-white'
                      : 'bg-white border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  Anthropic
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">
                API Key {apiKey && <span className="text-green-600">✓ Saved</span>}
              </label>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={
                    provider === 'openrouter'
                      ? 'sk-or-...'
                      : provider === 'openai'
                      ? 'sk-...'
                      : 'sk-ant-...'
                  }
                  className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded"
                />
                {apiKey && (
                  <button
                    onClick={handleClearApiKey}
                    className="px-2 py-1 text-xs bg-red-100 text-red-700 border border-red-300 rounded hover:bg-red-200"
                    title="Clear saved API key"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="flex items-center justify-between mt-1">
                {provider === 'openrouter' && (
                  <a
                    href="https://openrouter.ai/keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:text-blue-700 underline"
                  >
                    Get OpenRouter API key
                  </a>
                )}
                {apiKey && (
                  <span className="text-xs text-gray-500">
                    🔒 Saved for this session only
                  </span>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">
                Model {provider === 'openrouter' && '(recommended: anthropic/claude-3.5-sonnet)'}
              </label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder={
                  provider === 'openrouter'
                    ? 'anthropic/claude-3.5-sonnet (default)'
                    : provider === 'openai'
                    ? 'gpt-4 (default)'
                    : 'claude-3-5-sonnet-20241022 (default)'
                }
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
              />
              {provider === 'openrouter' && (
                <a
                  href="https://openrouter.ai/models"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:text-blue-700 underline"
                >
                  Browse available models
                </a>
              )}
            </div>
          </div>
        )}

        <p className="text-xs text-gray-600 mb-3">
          {mode === 'regex'
            ? 'Using regex patterns. Works offline but limited vocabulary.'
            : 'Using AI for better natural language understanding. Requires API key.'}
        </p>

        <textarea
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            mode === 'regex'
              ? 'e.g., "change to line chart", "color by Region", "top 10 by Sales"'
              : 'e.g., "Show me a scatter plot of Sales vs Profit colored by Region with a logarithmic y-axis"'
          }
          className="w-full px-3 py-2 border border-gray-300 rounded text-sm resize-none"
          rows={3}
        />

        <button
          onClick={handleApplyCommand}
          disabled={!command.trim() || isLoading}
          className="mt-2 px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Processing...' : 'Apply Command'}
        </button>

        {error && (
          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
            {error}
          </div>
        )}
      </div>

      {lastPlan && (
        <div className="p-3 bg-gray-50 border border-gray-200 rounded">
          <div className="text-xs font-semibold mb-1">Last Plan</div>
          <div className="text-xs text-gray-600 mb-2">
            Intent: {lastPlan.intentText}
          </div>
          <div className="text-xs text-gray-600 mb-2">
            Confidence: {Math.round((lastPlan.confidence ?? 0) * 100)}%
          </div>
          <details className="text-xs">
            <summary className="cursor-pointer text-blue-600 hover:text-blue-700">
              Show operations ({lastPlan.operations.length})
            </summary>
            <pre className="mt-2 p-2 bg-white border rounded text-xs overflow-auto">
              {JSON.stringify(lastPlan.operations, null, 2)}
            </pre>
          </details>
        </div>
      )}

      <div>
        <h4 className="text-xs font-semibold mb-2">Quick Commands</h4>
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => setCommand(suggestion)}
              className="px-2 py-1 text-xs bg-gray-100 border border-gray-300 rounded hover:bg-gray-200"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>

      <div className="border-t pt-4">
        <h4 className="text-xs font-semibold mb-2">Available Fields</h4>
        <div className="flex flex-wrap gap-1">
          {dataFields.map((field) => (
            <span
              key={field.name}
              className="px-2 py-1 text-xs bg-blue-50 border border-blue-200 rounded"
              title={`Type: ${field.inferredType}`}
            >
              {field.name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
