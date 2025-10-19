# Vega Config Tool - Architecture Walkthrough

## Overview

This is a React-based Vega-Lite chart configuration tool that allows users to create and customize data visualizations through a visual builder interface, AI-powered natural language commands, and direct JSON spec editing.

## Tech Stack

- **React 18** with TypeScript
- **Zustand** with Immer middleware for state management
- **Vega-Lite** and Vega-Embed for chart rendering
- **TailwindCSS v3** for styling
- **AI Integration**: OpenRouter, OpenAI, and Anthropic APIs

## Project Structure

```
src/
├── components/
│   ├── VegaConfigWidget.tsx    # Main widget container
│   ├── ChartPreview.tsx         # Vega chart renderer
│   └── panels/
│       ├── AIPanel.tsx          # Natural language AI commands
│       ├── MarkPanel.tsx        # Chart type selection
│       ├── EncodingsPanel.tsx   # Data field mappings
│       ├── SpecPanel.tsx        # JSON spec editor
│       └── DataPanel.tsx        # Data table view (hidden)
├── store/
│   └── widgetStore.ts           # Zustand state management
├── types/
│   └── index.ts                 # TypeScript type definitions
└── utils/
    ├── aiService.ts             # AI provider integrations
    ├── fieldInference.ts        # Auto-detect field types
    ├── nlPlanner.ts             # Regex-based NL parser
    └── specBuilder.ts           # BuilderState → Vega spec
```

---

## Core Architecture

### 1. State Management (`widgetStore.ts`)

The application uses **Zustand with Immer** for state management. Immer provides immutable updates with a mutable API.

#### State Structure

```typescript
{
  // Data
  data: any[]                    // Chart data rows
  dataFields: DataField[]        // Inferred field metadata

  // Chart configuration
  builderState: BuilderState     // Simple chart config
  vegaSpec: VisualizationSpec    // Vega-Lite JSON spec

  // UI state
  activeTab: TabType             // Current panel
  validationErrors: ValidationError[]

  // History (undo/redo)
  history: StateSnapshot[]       // Past states
  historyIndex: number           // Current position

  // AI
  aiCommand: string              // Last command
  lastPlan: ChartEditPlan        // Parsed operations
}
```

#### Key Actions

- **setData(data)**: Updates data + regenerates spec from BuilderState
- **setDataOnly(data)**: Updates data WITHOUT regenerating spec (for custom specs)
- **setBuilderState(updates)**: Updates BuilderState + regenerates spec
- **setSpec(spec, builderState?)**: Directly sets spec (for custom specs)
- **captureSnapshot(description)**: Saves state for undo/redo
- **undo() / redo()**: Navigate history

#### Critical Implementation Detail: Data Cloning

```typescript
setData: (data: any[]) => {
  set((state) => {
    state.data = data;
    state.dataFields = inferFields(data);
    state.vegaSpec = buildSpec(state.builderState, state.dataFields);
  });
}
```

**Important**: When data is passed to Vega-Embed, it must be **deep cloned** to avoid Immer's object freezing in development mode. See ChartPreview section below.

---

### 2. Two-Level Configuration System

The tool supports two types of chart specifications:

#### A. Simple Charts (BuilderState)

For basic charts, users interact with visual controls (Mark, Encodings panels) that update a `BuilderState` object:

```typescript
interface BuilderState {
  mark: {
    type: 'bar' | 'line' | 'area' | 'point' | ...
    point?: boolean      // Show points on line/area
    stacked?: 'zero' | 'normalize' | null
  }
  encodings: {
    x?: EncodingConfig   // { field, type, aggregate, sort }
    y?: EncodingConfig
    color?: EncodingConfig
    size?: EncodingConfig
  }
  // ... filters, sorts, limits
}
```

**Flow**: BuilderState → `buildSpec()` → Vega-Lite JSON

#### B. Custom/Complex Specs (Direct Spec Editing)

For advanced features not representable in BuilderState:
- Faceted charts (`facet`, `hconcat`, `vconcat`)
- Layered charts (`layer`)
- External data sources (`data.url`)
- Complex transforms (> 3 operations)

**Detection logic** (in panels):
```typescript
const isCustomSpec = !!(
  vegaSpec.facet ||
  vegaSpec.layer ||
  vegaSpec.hconcat ||
  vegaSpec.vconcat ||
  vegaSpec.repeat ||
  (vegaSpec.transform && vegaSpec.transform.length > 3) ||
  (vegaSpec.data && vegaSpec.data.url)
);
```

When a custom spec is detected:
- Mark/Encodings panels show a warning and disable controls
- AI Assistant switches to **GenAI mode** (direct spec editing)
- Spec panel remains fully functional

---

### 3. Component Hierarchy

```
VegaConfigWidget (main container)
├── Left Panel (collapsible)
│   ├── Tab Bar
│   │   ├── Mark
│   │   ├── Encodings
│   │   ├── AI Assistant
│   │   └── Spec
│   └── Active Panel Content
│       ├── MarkPanel (chart type selector)
│       ├── EncodingsPanel (x/y/color/size mapping)
│       ├── AIPanel (NL commands + GenAI)
│       └── SpecPanel (Monaco-style JSON editor)
└── Right Panel (preview)
    ├── Header (export buttons)
    └── ChartPreview (Vega-Embed renderer)
```

#### VegaConfigWidget (`VegaConfigWidget.tsx`)

**Responsibilities**:
- Layout and panel management
- Undo/redo keyboard shortcuts (Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z)
- Export buttons (JSON, PDF)
- Status bar (undo/redo buttons, data stats)

**Props**:
```typescript
interface VegaWidgetConfig {
  data?: any[]                          // Initial data
  builderState?: Partial<BuilderState>  // Initial config
  callbacks?: {
    onSpecChange?: (spec: VisualizationSpec) => void
  }
}
```

**Key Features**:
- Collapsible panel with minimalist toggle (‹/›)
- Keyboard shortcuts for undo/redo
- History tracking (up to 50 snapshots)

---

### 4. ChartPreview (`ChartPreview.tsx`)

Renders Vega-Lite charts using `vega-embed`.

#### Critical Data Handling

```typescript
useEffect(() => {
  // Deep clone data to avoid "object is not extensible" error
  // Zustand with Immer freezes objects, but Vega needs to add Symbol properties
  const clonedData = JSON.parse(JSON.stringify(data));

  let specToRender;
  if (spec.data && spec.data.url) {
    // External data - use spec as-is
    specToRender = spec;
  } else {
    // Inject cloned data
    specToRender = {
      ...spec,
      data: { values: clonedData }
    };
  }

  embed(containerRef.current, specToRender, {
    actions: { export: true, source: false, compiled: false, editor: false },
    renderer: 'canvas',
    mode: 'vega-lite'
  });
}, [spec, data]);
```

**Why deep clone?**
- Zustand with Immer freezes state objects in development mode
- Vega-Embed tries to add Symbol properties to data objects
- Frozen objects throw "Cannot add property to non-extensible object"
- Solution: `JSON.parse(JSON.stringify(data))` creates a mutable copy

**Canvas ID**: The container has `id="vega-chart-container"` for PDF export to find the canvas element.

---

### 5. AI Panel (`AIPanel.tsx`)

Two modes for natural language chart editing:

#### A. Regex Mode (Free, Offline)

Pattern-based parsing with `nlPlanner.ts`:

```typescript
// Examples:
"change to line chart"       → { op: 'set_mark', mark: 'line' }
"color by Region"            → { op: 'set_encoding', channel: 'color', field: 'Region' }
"top 10 by Sales"            → { op: 'set_limit', limit: 10, sort: 'Sales:desc' }
"make West blue"             → { op: 'set_color_mapping', value: 'West', color: 'blue' }
```

**Limitations**:
- Fixed vocabulary
- Can't handle complex requests
- Regenerates spec from BuilderState (loses customizations)

#### B. GenAI Mode (Requires API Key)

Uses LLM providers (OpenRouter, OpenAI, Anthropic) via `aiService.ts`:

**For Simple Specs**:
```typescript
parseNLWithAI(command, fieldNames, builderState, dataFields, config)
  → ChartEditPlan (operations)
  → applyPlan() → updated BuilderState
  → regenerated spec
```

**For Custom Specs** (direct editing):
```typescript
editSpecWithAI(command, currentSpec, dataFields, config)
  → modified Vega-Lite JSON (preserves structure)
  → setSpec(modifiedSpec)
```

**Prompt for custom specs**:
```
You are a Vega-Lite expert. The user has a complex spec and wants to modify it.

Current spec: { ... }
User request: "add a red trend line"

Return MODIFIED Vega-Lite spec as JSON. Preserve faceting/layering/transforms.
```

#### Settings Persistence

All AI settings are saved to `localStorage`:
- `vega_widget_ai_mode`: 'regex' | 'ai'
- `vega_widget_ai_provider`: 'openrouter' | 'openai' | 'anthropic'
- `vega_widget_ai_api_key`: API key (encrypted by browser)
- `vega_widget_ai_model`: Model identifier

#### Auto-Switching

```typescript
useEffect(() => {
  if (isCustomSpec && mode === 'regex') {
    setMode('ai');  // Force GenAI for custom specs
  }
}, [isCustomSpec, mode]);
```

---

### 6. Mark and Encodings Panels

These panels provide visual controls for BuilderState.

#### MarkPanel (`MarkPanel.tsx`)

- **Chart types**: bar, line, area, point, circle, square, tick, rect, rule, text
- **Options**:
  - Show points (for line/area)
  - Stacking: none / zero / normalize (for bar/area)

#### EncodingsPanel (`EncodingsPanel.tsx`)

Four encoding channels with individual controls:

```typescript
<EncodingChannel
  label="X Axis"
  channel="x"
  encoding={builderState.encodings.x}
  onUpdate={(config) => handleEncodingUpdate('x', config)}
/>
```

Each channel has:
- **Field**: dropdown of data fields
- **Type**: quantitative, nominal, ordinal, temporal
- **Aggregate**: sum, mean, median, count, min, max, distinct, q1, q3

#### Custom Spec Warning

When `isCustomSpec === true`, both panels show:

```
⚠️ Custom Spec - Builder Disabled

You're viewing a complex spec (faceted, layered, or with external data)
that can't be edited through the builder panels.

Options:
• Use the AI Assistant tab (GenAI mode) to modify this spec
• Use the Spec tab to manually edit the JSON
• Reset to a simple chart to use the builder
```

---

### 7. Spec Panel (`SpecPanel.tsx`)

Monaco-style JSON editor for direct spec manipulation.

#### Features

- **Syntax highlighting** (via textarea with basic styling)
- **Validation**: Checks for valid JSON and required Vega-Lite properties
- **Data extraction**: If spec contains inline data (`data.values`), extracts it to store
- **Two-way sync**: Parses spec to update BuilderState when possible

#### Save Flow

```typescript
const handleSaveSpec = () => {
  const parsed = JSON.parse(rawSpec);

  // Validate: must have mark (simple) or facet/layer/etc (complex)
  if (!parsed.mark && !parsed.facet && !parsed.layer && ...) {
    setError('Invalid spec');
    return;
  }

  // Extract inline data if present
  if (parsed.data?.values) {
    const extractedData = parsed.data.values;
    setDataOnly(extractedData);  // Don't regenerate spec

    // Remove data from spec (it's now in store)
    delete parsed.data;
    parsed.data = { name: 'table' };
  }

  // Try to parse back to BuilderState
  const builderState = parseSpecToBuilderState(parsed, dataFields);

  setSpec(parsed, builderState);
};
```

**parseSpecToBuilderState** attempts to extract:
- Mark type from `spec.mark` or `spec.mark.type`
- Encodings from `spec.encoding.x/y/color/size`
- Transforms (filters, sorts, limits)

If the spec is too complex, BuilderState remains unchanged but the spec is still saved.

---

### 8. Export Features

Located in VegaConfigWidget header, right side of preview panel.

#### JSON Export

```typescript
<button onClick={() => {
  const json = JSON.stringify(vegaSpec, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'vega-spec.json';
  a.click();
  URL.revokeObjectURL(url);
}}>
  📄 JSON
</button>
```

Downloads the current Vega-Lite spec as a formatted JSON file.

#### PDF Export

```typescript
<button onClick={async () => {
  // Find canvas element
  const canvas = document.querySelector('#vega-chart-container canvas') as HTMLCanvasElement;
  if (!canvas) {
    alert('Chart not rendered yet. Please wait for the chart to load.');
    return;
  }

  // Convert canvas to PNG data URL
  const imgData = canvas.toDataURL('image/png');

  // Dynamically import jsPDF from CDN
  const { jsPDF } = await import('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/+esm');

  // Create PDF with chart dimensions
  const pdf = new jsPDF({
    orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
    unit: 'px',
    format: [canvas.width, canvas.height]
  });

  // Add image and download
  pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
  pdf.save('chart.pdf');
}}>
  📕 PDF
</button>
```

**How it works**:
1. Finds the Vega chart canvas using `#vega-chart-container canvas`
2. Converts canvas to PNG via `toDataURL()`
3. Loads jsPDF dynamically from jsdelivr CDN
4. Creates PDF matching canvas dimensions (auto-detects orientation)
5. Embeds PNG image and triggers download

**Limitations**: Requires chart to be fully rendered; internet connection needed for jsPDF CDN.

---

### 9. Undo/Redo System

History is managed through state snapshots.

#### Snapshot Structure

```typescript
interface StateSnapshot {
  builderState: BuilderState
  spec: VisualizationSpec
  timestamp: number
  description?: string  // e.g., "AI: change to line chart"
}
```

#### Capturing Snapshots

```typescript
captureSnapshot: (description?: string) => {
  set((state) => {
    const snapshot = {
      builderState: JSON.parse(JSON.stringify(state.builderState)),
      spec: JSON.parse(JSON.stringify(state.vegaSpec)),
      timestamp: Date.now(),
      description
    };

    // Remove future snapshots when making new change after undo
    state.history = state.history.slice(0, state.historyIndex + 1);

    state.history.push(snapshot);
    state.historyIndex = state.history.length - 1;

    // Limit to 50 snapshots
    if (state.history.length > 50) {
      state.history = state.history.slice(-50);
      state.historyIndex = state.history.length - 1;
    }
  });
}
```

#### Keyboard Shortcuts

```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      undo();
    } else if ((e.metaKey || e.ctrlKey) && (e.key === 'Z' || (e.key === 'z' && e.shiftKey))) {
      e.preventDefault();
      redo();
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [canUndo, canRedo]);
```

- **Cmd/Ctrl+Z**: Undo
- **Cmd/Ctrl+Shift+Z**: Redo

**When snapshots are captured**:
- Changing mark type
- Updating encodings
- Applying AI commands
- Saving spec edits

---

### 10. Field Type Inference (`fieldInference.ts`)

Auto-detects field types from data:

```typescript
function inferFields(data: any[]): DataField[] {
  const fields = Object.keys(data[0] || {});

  return fields.map(name => {
    const values = data.map(row => row[name]);

    // Check for dates
    if (values.some(v => v instanceof Date || isDateString(v))) {
      return { name, inferredType: 'temporal' };
    }

    // Check for numbers
    if (values.every(v => typeof v === 'number' || !isNaN(Number(v)))) {
      return { name, inferredType: 'quantitative' };
    }

    // Default to nominal
    return { name, inferredType: 'nominal' };
  });
}
```

**Used for**:
- Pre-filling encoding type dropdowns
- AI context (field metadata for LLM)
- Validation (warn if quantitative field used without aggregate)

---

### 11. Spec Builder (`specBuilder.ts`)

Converts BuilderState → Vega-Lite JSON.

```typescript
function buildSpec(state: BuilderState, fields: DataField[]): VisualizationSpec {
  const spec: any = {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    data: { name: 'table' },
    mark: state.mark.point ? { type: state.mark.type, point: true } : state.mark.type,
    encoding: {}
  };

  // Add encodings
  if (state.encodings.x) {
    spec.encoding.x = buildEncodingDef(state.encodings.x, state.mark.stacked);
  }
  if (state.encodings.y) {
    spec.encoding.y = buildEncodingDef(state.encodings.y, state.mark.stacked);
  }
  // ... color, size

  // Add transforms (filters, aggregates, sorts, limits)
  spec.transform = buildTransforms(state);

  return spec;
}
```

**Handles**:
- Mark type and options (point overlay, stacking)
- Encoding channels with field/type/aggregate/sort
- Transforms (filter, aggregate, sort, limit)
- Color scales and ranges
- Axis labels and formatting

---

## Data Flow Diagrams

### Simple Chart Editing Flow

```
User clicks "Bar" in MarkPanel
  ↓
captureSnapshot("Change mark to bar")
  ↓
setBuilderState({ mark: { type: 'bar' } })
  ↓
buildSpec(newBuilderState, dataFields)
  ↓
vegaSpec updated
  ↓
ChartPreview re-renders with new spec
```

### AI Command Flow (Simple Spec, GenAI Mode)

```
User types "color by Region", clicks Apply
  ↓
parseNLWithAI(command, fields, builderState, dataFields, { provider, apiKey, model })
  ↓
LLM returns: { operations: [{ op: 'set_encoding', channel: 'color', field: 'Region' }] }
  ↓
applyPlan(builderState, plan, dataFields)
  ↓
captureSnapshot("AI: color by Region")
  ↓
setBuilderState(updatedBuilderState)
  ↓
buildSpec() → vegaSpec updated
  ↓
ChartPreview re-renders
```

### AI Command Flow (Custom Spec, GenAI Mode)

```
User has faceted spec, types "make bars thicker"
  ↓
isCustomSpec === true detected
  ↓
editSpecWithAI(command, vegaSpec, dataFields, config)
  ↓
LLM receives full spec, returns modified spec with `mark: { type: 'bar', thickness: 20 }`
  ↓
captureSnapshot("AI: make bars thicker")
  ↓
setSpec(modifiedSpec)  // Direct spec update, no BuilderState regeneration
  ↓
ChartPreview re-renders
```

### Spec Panel Save Flow

```
User pastes complex spec with inline data in Spec Panel
  ↓
User clicks Save
  ↓
Validate JSON
  ↓
Extract data.values → extractedData
  ↓
Remove data.values from spec, replace with { name: 'table' }
  ↓
setDataOnly(extractedData)  // Don't regenerate spec
  ↓
Attempt parseSpecToBuilderState(spec, dataFields)
  ↓
setSpec(spec, parsedBuilderState)
  ↓
isCustomSpec === true (faceted spec)
  ↓
Mark/Encodings panels show warning, disable controls
  ↓
AI Panel auto-switches to GenAI mode
```

---

## Common Patterns

### 1. Handling Simple vs Custom Specs

**In panels (Mark, Encodings)**:
```typescript
const isCustomSpec = !!(vegaSpec.facet || vegaSpec.layer || ...);

if (isCustomSpec) {
  return <CustomSpecWarning />;
}

return <BuilderControls />;
```

**In AI Panel**:
```typescript
if (mode === 'ai' && isCustomSpec) {
  // Direct spec editing
  const result = await editSpecWithAI(...);
  setSpec(result.spec);
} else {
  // Standard BuilderState flow
  const plan = await parseNLWithAI(...);
  const nextState = applyPlan(builderState, plan, dataFields);
  setBuilderState(nextState);
}
```

### 2. Snapshot Before Mutations

Every user action that modifies the chart should capture a snapshot first:

```typescript
const handleMarkChange = (markType: MarkType) => {
  captureSnapshot(`Change mark to ${markType}`);
  setBuilderState({ mark: { ...builderState.mark, type: markType } });
};
```

### 3. Deep Cloning for Vega

Always clone data before passing to Vega to avoid Immer freezing issues:

```typescript
const clonedData = JSON.parse(JSON.stringify(data));
embed(container, { ...spec, data: { values: clonedData } }, options);
```

### 4. LocalStorage Persistence

```typescript
const [apiKey, setApiKey] = useState(() => {
  return localStorage.getItem(STORAGE_KEYS.AI_API_KEY) || '';
});

useEffect(() => {
  localStorage.setItem(STORAGE_KEYS.AI_API_KEY, apiKey);
}, [apiKey]);
```

---

## Edge Cases and Error Handling

### 1. Chart Not Rendered Yet

PDF export checks for canvas before proceeding:
```typescript
const canvas = document.querySelector('#vega-chart-container canvas');
if (!canvas) {
  alert('Chart not rendered yet. Please wait for the chart to load.');
  return;
}
```

### 2. Invalid Spec

Spec Panel validation:
```typescript
const parsed = JSON.parse(rawSpec);
if (!parsed.mark && !parsed.facet && !parsed.layer && ...) {
  setError('Invalid Vega-Lite spec: missing mark or composition operator');
  return;
}
```

### 3. AI API Errors

```typescript
try {
  const result = await editSpecWithAI(...);
  if (!result.success) {
    setError(result.error || 'Failed to edit spec');
  }
} catch (err) {
  setError(err instanceof Error ? err.message : 'Unknown error');
  console.error('AI error:', err);
}
```

### 4. External Data URLs

ChartPreview detects and preserves external data sources:
```typescript
if (spec.data && spec.data.url) {
  // Don't inject data - spec loads from URL
  specToRender = spec;
} else {
  // Inject store data
  specToRender = { ...spec, data: { values: clonedData } };
}
```

---

## Performance Considerations

### 1. Spec Regeneration

BuilderState changes trigger full spec regeneration. For custom specs, use `setSpec()` to avoid this.

### 2. History Limit

History is limited to 50 snapshots to prevent memory bloat:
```typescript
if (state.history.length > 50) {
  state.history = state.history.slice(-50);
}
```

### 3. Deep Cloning

`JSON.parse(JSON.stringify())` is used for cloning. This works for JSON-serializable data but will fail on:
- Functions
- Symbols
- Circular references
- undefined values

For chart data, this is typically fine.

### 4. Dynamic Import for jsPDF

jsPDF is only loaded when PDF export is clicked, reducing initial bundle size.

---

## Security Considerations

### 1. API Key Storage

API keys are stored in `localStorage`, which is:
- ✅ Persistent across sessions
- ✅ Scoped to domain
- ❌ Not encrypted (visible in DevTools)
- ❌ Accessible to JavaScript on same domain

**Recommendation**: For production, use server-side API proxy to avoid exposing keys to client.

### 2. Spec Validation

Currently minimal validation. Malicious specs could:
- Load external data from untrusted URLs (`data.url`)
- Execute transforms that consume excessive memory

**Recommendation**: Add sandboxing or server-side spec validation.

---

## Testing Strategy

### Recommended Test Cases

1. **Data Cloning**: Verify Vega can render charts with Immer-frozen data
2. **Custom Spec Detection**: Test faceted, layered, complex transform specs
3. **Undo/Redo**: Verify history integrity with branching (undo, then new change)
4. **AI Modes**: Test both regex and GenAI with simple and custom specs
5. **Export**: Test JSON and PDF export with various chart types
6. **LocalStorage**: Verify API key persistence across page reloads
7. **Spec Parsing**: Test parseSpecToBuilderState with edge cases

---

## Future Enhancements

### Potential Features

1. **Data Upload**: CSV/JSON file upload to replace default data
2. **Theme Editor**: Customize colors, fonts, sizes globally
3. **Template Library**: Pre-built chart templates (e.g., "dashboard", "report")
4. **Collaboration**: Share specs via URL or embed codes
5. **Server-Side Rendering**: Generate chart images without browser
6. **Advanced Transforms**: Visual editors for calculate, window, bin, timeUnit
7. **Multi-Chart Composition**: Visual editor for hconcat/vconcat layouts
8. **Real-Time Data**: WebSocket/polling for live data updates
9. **Export to Code**: Generate Python (Altair) or JavaScript (vega-lite-api) code
10. **Accessibility**: ARIA labels, keyboard navigation, screen reader support

---

## Debugging Tips

### Common Issues

**Chart shows "Infinite extent" error**
- Data not properly injected into spec
- Missing or invalid field mappings
- Check: `console.log('Data:', data, 'Spec:', vegaSpec)` in ChartPreview

**AI commands not working**
- Check API key is saved: `localStorage.getItem('vega_widget_ai_api_key')`
- Check network tab for API errors
- Verify provider/model are correct

**Spec reverts to default after panel interaction**
- Custom spec detected but panels not disabled
- Check: `isCustomSpec` logic in Mark/Encodings panels

**Undo/Redo not working**
- Snapshots not being captured
- Check: `history` and `historyIndex` in Zustand DevTools

**PDF export fails**
- Chart not fully rendered
- Canvas selector incorrect
- Check: `document.querySelector('#vega-chart-container canvas')`

### DevTools Extensions

- **React DevTools**: Inspect component tree and props
- **Zustand DevTools**: View state, history, and dispatched actions
- **Vega Editor**: Copy spec and debug in https://vega.github.io/editor/

---

## Conclusion

This Vega Config Tool bridges the gap between visual chart builders and direct JSON editing, with AI-powered natural language commands for both simple and complex specifications. The architecture balances:

- **Simplicity**: Visual controls for common tasks
- **Power**: Direct spec editing for advanced features
- **Intelligence**: AI assistance for both modes
- **Reliability**: Undo/redo, validation, error handling

Key architectural decisions:
1. **Dual-mode system** (BuilderState vs direct spec) with automatic detection
2. **Zustand + Immer** for predictable state updates with immutability
3. **Deep cloning** to work around Immer freezing issues
4. **AI provider flexibility** (OpenRouter, OpenAI, Anthropic)
5. **Snapshot-based history** for unlimited undo/redo

The codebase is modular, type-safe, and ready for extension with new chart types, AI providers, or export formats.
