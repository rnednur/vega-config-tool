import type { BuilderState, ChartEditPlan, DataField } from '@/types';
import type { VisualizationSpec } from 'vega-embed';

export type AIProvider = 'openai' | 'anthropic' | 'openrouter';

interface AIServiceConfig {
  provider: AIProvider;
  apiKey: string;
  model?: string;
}

export interface AISpecEditResult {
  success: boolean;
  spec?: VisualizationSpec;
  plan?: ChartEditPlan;
  error?: string;
  usedDirectEdit?: boolean;
}

/**
 * Use GenAI (OpenAI or Anthropic) to parse natural language into a ChartEditPlan
 */
export async function parseNLWithAI(
  input: string,
  fieldNames: string[],
  builder: BuilderState,
  dataFields: DataField[],
  config: AIServiceConfig
): Promise<ChartEditPlan> {
  const { provider, apiKey, model } = config;

  // Build the prompt with context
  const prompt = buildPrompt(input, fieldNames, builder, dataFields);

  // Call the appropriate API
  let operations;
  if (provider === 'openai') {
    operations = await callOpenAI(prompt, apiKey, model ?? 'gpt-4');
  } else if (provider === 'anthropic') {
    operations = await callAnthropic(prompt, apiKey, model ?? 'claude-3-5-sonnet-20241022');
  } else if (provider === 'openrouter') {
    operations = await callOpenRouter(prompt, apiKey, model ?? 'anthropic/claude-3.5-sonnet');
  } else {
    throw new Error(`Unknown provider: ${provider}`);
  }

  return {
    intentText: input,
    confidence: 0.9, // AI is generally more confident than regex
    operations,
  };
}

/**
 * Use GenAI to directly edit a Vega-Lite spec (for complex specs)
 * Returns the modified spec directly instead of operations
 */
export async function editSpecWithAI(
  input: string,
  currentSpec: VisualizationSpec,
  dataFields: DataField[],
  config: AIServiceConfig
): Promise<AISpecEditResult> {
  const { provider, apiKey, model } = config;

  try {
    const fieldInfo = dataFields.map(f => `- ${f.name} (${f.inferredType})`).join('\n');

    const prompt = `You are a Vega-Lite expert. The user has a complex Vega-Lite specification and wants to modify it.

Available data fields:
${fieldInfo}

Current Vega-Lite spec:
${JSON.stringify(currentSpec, null, 2)}

User's modification request: "${input}"

Please return the MODIFIED Vega-Lite spec as valid JSON. Preserve the structure and complexity of the original spec (faceting, layering, transforms, etc.) but apply the user's requested changes.

Respond with ONLY the complete modified JSON spec, nothing else. No markdown, no explanation.`;

    let modifiedSpecText: string;

    if (provider === 'openai') {
      modifiedSpecText = await callOpenAIForSpec(prompt, apiKey, model ?? 'gpt-4');
    } else if (provider === 'anthropic') {
      modifiedSpecText = await callAnthropicForSpec(prompt, apiKey, model ?? 'claude-3-5-sonnet-20241022');
    } else if (provider === 'openrouter') {
      modifiedSpecText = await callOpenRouterForSpec(prompt, apiKey, model ?? 'anthropic/claude-3.5-sonnet');
    } else {
      throw new Error(`Unknown provider: ${provider}`);
    }

    // Parse the modified spec
    const modifiedSpec = JSON.parse(modifiedSpecText);

    return {
      success: true,
      spec: modifiedSpec,
      usedDirectEdit: true,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to edit spec with AI',
    };
  }
}

/**
 * Build a detailed prompt for the AI
 */
function buildPrompt(
  input: string,
  fieldNames: string[],
  builder: BuilderState,
  dataFields: DataField[]
): string {
  const fieldInfo = dataFields.map(f => `- ${f.name} (${f.inferredType})`).join('\n');

  const currentState = {
    mark: builder.mark.type,
    encodings: Object.entries(builder.encodings)
      .filter(([_, enc]) => enc?.field)
      .map(([channel, enc]) => `${channel}: ${enc?.field}`)
      .join(', '),
  };

  return `You are a Vega-Lite chart configuration assistant. Convert the user's natural language command into a structured list of operations.

Available data fields:
${fieldInfo}

Current chart state:
- Mark type: ${currentState.mark}
- Encodings: ${currentState.encodings || 'none'}

User command: "${input}"

Available operation types:
1. set_mark: Change chart type (bar, line, area, point, circle, square, tick, rect, rule, text)
   Example: {"op": "set_mark", "mark": "line", "options": {"point": true}}

2. set_encoding: Map a field to a visual channel (x, y, color, size)
   Example: {"op": "set_encoding", "channel": "color", "field": "Region", "type": "nominal"}

3. set_series_colors: Set custom colors for specific categories
   Example: {"op": "set_series_colors", "colors": {"West": "#1f77b4", "East": "#ff7f0e"}}

4. set_color_scheme: Use a predefined color scheme (viridis, tableau10, category10, etc.)
   Example: {"op": "set_color_scheme", "scheme": "viridis"}

5. set_top_n: Filter to top N records
   Example: {"op": "set_top_n", "n": 10, "byField": "Sales", "order": "descending"}

6. set_sort: Sort data
   Example: {"op": "set_sort", "channelOrField": "y", "by": "Sales", "order": "descending"}

7. add_filter: Add a data filter
   Example: {"op": "add_filter", "expr": "datum.Sales > 100"}

8. set_aggregate: Set aggregation function
   Example: {"op": "set_aggregate", "channel": "y", "op": "sum"}

9. set_title: Set chart title
   Example: {"op": "set_title", "title": "Sales Overview"}

10. set_size: Set chart dimensions
    Example: {"op": "set_size", "width": 600, "height": 400}

11. remove_encoding: Remove an encoding
    Example: {"op": "remove_encoding", "channel": "color"}

Respond with ONLY a valid JSON array of operations, nothing else. No markdown, no explanation.
Example response: [{"op": "set_mark", "mark": "line"}, {"op": "set_encoding", "channel": "color", "field": "Region"}]`;
}

/**
 * Call OpenAI API
 */
async function callOpenAI(prompt: string, apiKey: string, model: string): Promise<any[]> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that converts natural language to structured JSON operations for Vega-Lite charts. Always respond with valid JSON arrays only.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 1000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content.trim();

  // Remove markdown code blocks if present
  const cleaned = content.replace(/```json\s*|\s*```/g, '').trim();

  return JSON.parse(cleaned);
}

/**
 * Call Anthropic API
 */
async function callAnthropic(prompt: string, apiKey: string, model: string): Promise<any[]> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const content = data.content[0].text.trim();

  // Remove markdown code blocks if present
  const cleaned = content.replace(/```json\s*|\s*```/g, '').trim();

  return JSON.parse(cleaned);
}

/**
 * Call OpenAI API for full spec editing
 */
async function callOpenAIForSpec(prompt: string, apiKey: string, model: string): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are a Vega-Lite expert. You modify Vega-Lite specs based on user requests. Always respond with valid JSON only.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.2,
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content.trim();
  return content.replace(/```json\s*|\s*```/g, '').trim();
}

/**
 * Call Anthropic API for full spec editing
 */
async function callAnthropicForSpec(prompt: string, apiKey: string, model: string): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const content = data.content[0].text.trim();
  return content.replace(/```json\s*|\s*```/g, '').trim();
}

/**
 * Call OpenRouter API for full spec editing
 */
async function callOpenRouterForSpec(prompt: string, apiKey: string, model: string): Promise<string> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': window.location.origin,
      'X-Title': 'Vega Chart Config Widget',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are a Vega-Lite expert. You modify Vega-Lite specs based on user requests. Always respond with valid JSON only.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.2,
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content.trim();
  return content.replace(/```json\s*|\s*```/g, '').trim();
}

/**
 * Call OpenRouter API (OpenAI-compatible endpoint)
 */
async function callOpenRouter(prompt: string, apiKey: string, model: string): Promise<any[]> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': window.location.origin, // Required by OpenRouter
      'X-Title': 'Vega Chart Config Widget', // Optional, helps OpenRouter track usage
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that converts natural language to structured JSON operations for Vega-Lite charts. Always respond with valid JSON arrays only.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 1000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content.trim();

  // Remove markdown code blocks if present
  const cleaned = content.replace(/```json\s*|\s*```/g, '').trim();

  return JSON.parse(cleaned);
}
