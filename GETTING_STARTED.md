# Getting Started with Vega Config Widget

## What You Have Now

A fully functional React application with:

✅ **Visual Chart Builder** - Configure charts through intuitive panels
✅ **AI Assistant** - Modify charts using natural language
✅ **Real-time Preview** - See changes instantly
✅ **Undo/Redo** - Full history with keyboard shortcuts
✅ **Type Inference** - Automatic field type detection

## Try It Out

The app is currently running at **http://localhost:5174/**

### Sample Commands to Try

Open the AI Assistant tab and try these commands:

1. **"change to line chart"** - Switches visualization to line chart
2. **"color by Region"** - Adds color encoding by Region field
3. **"make West blue and East orange"** - Sets custom colors for categories
4. **"top 10 by Sales"** - Filters to show top 10 items
5. **"sort by Sales descending"** - Sorts the data
6. **"use viridis color scheme"** - Applies a color scheme

### Using the Visual Panels

**Mark Panel**
- Click different mark types (Bar, Line, Area, Point, etc.)
- Toggle stacking for bar/area charts
- Enable point overlays for line charts

**Encodings Panel**
- Assign fields to X, Y, Color, and Size channels
- Change data types (Quantitative, Nominal, Ordinal, Temporal)
- Add aggregations (sum, mean, count, etc.)

**Undo/Redo**
- Use `Cmd/Ctrl+Z` to undo
- Use `Cmd/Ctrl+Shift+Z` to redo

## Project Structure

```
vega_config_tool/
├── src/
│   ├── components/
│   │   ├── VegaConfigWidget.tsx     # Main widget
│   │   ├── ChartPreview.tsx         # Chart renderer
│   │   └── panels/
│   │       ├── MarkPanel.tsx        # Mark selection
│   │       ├── EncodingsPanel.tsx   # Field mappings
│   │       └── AIPanel.tsx          # Natural language
│   ├── store/
│   │   └── widgetStore.ts           # State management (Zustand)
│   ├── utils/
│   │   ├── fieldInference.ts        # Auto-detect field types
│   │   ├── specBuilder.ts           # Generate Vega-Lite specs
│   │   └── nlPlanner.ts             # Parse AI commands
│   └── types/
│       └── index.ts                 # TypeScript definitions
├── REQUIREMENTS.md                   # Full requirements doc
├── README.md                         # Project overview
└── package.json
```

## Next Steps

### 1. Customize the Data

Edit `src/App.tsx` and replace `SAMPLE_DATA` with your own data:

```tsx
const YOUR_DATA = [
  { product: 'Widget A', revenue: 5000, quarter: 'Q1' },
  { product: 'Widget B', revenue: 7500, quarter: 'Q1' },
  // ... your data
];
```

### 2. Add More Features

Current implementation is MVP. See `REQUIREMENTS.md` for:

- **Transform Panel** - Filters, calculations, aggregations
- **Style Panel** - Colors, fonts, sizing, themes
- **Spec Editor** - Direct JSON editing with Monaco
- **Data Upload** - CSV/JSON file import
- **Templates** - Pre-built chart templates
- **Export** - PNG, SVG, PDF export

### 3. Enhance AI Commands

Edit `src/utils/nlPlanner.ts` to add more command patterns:

```typescript
// Example: Add support for "bin by 10"
const binMatch = lower.match(/bin\s+([a-zA-Z0-9_]+)\s+by\s+(\d+)/);
if (binMatch) {
  const field = resolveField(binMatch[1], fieldNames);
  const bins = parseInt(binMatch[2], 10);
  ops.push({
    op: 'set_bin',
    channel: 'x',
    field,
    maxbins: bins
  });
}
```

### 4. Integrate with Backend

Add API integration for:

- Loading data from REST endpoints
- Saving chart configurations
- Sharing charts with teams
- Embedding charts in other apps

Example:

```tsx
const { data } = useFetch('/api/sales-data');

<VegaConfigWidget
  data={data}
  callbacks={{
    onSpecChange: (spec) => {
      // Save to backend
      fetch('/api/charts', {
        method: 'POST',
        body: JSON.stringify(spec)
      });
    }
  }}
/>
```

### 5. Add LLM Integration

Replace the simple parser with real LLM calls:

```typescript
// In nlPlanner.ts
async function parseWithLLM(command: string, context: any) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a chart configuration assistant. Output JSON operations only.'
        },
        {
          role: 'user',
          content: `Command: "${command}"\nContext: ${JSON.stringify(context)}`
        }
      ],
    }),
  });

  const { operations } = await response.json();
  return operations;
}
```

## Common Tasks

### Adding a New Mark Type

1. Add type to `src/types/index.ts`:
```typescript
export type MarkType = 'bar' | 'line' | 'area' | 'point' | 'yourmark';
```

2. Add to mark selector in `src/components/panels/MarkPanel.tsx`

3. Update spec builder in `src/utils/specBuilder.ts`

### Adding a New Encoding Channel

1. Update `BuilderState` in `src/types/index.ts`:
```typescript
encodings: {
  x?: EncodingConfig;
  y?: EncodingConfig;
  color?: EncodingConfig;
  yourChannel?: EncodingConfig; // Add here
}
```

2. Add channel editor in `EncodingsPanel.tsx`

3. Update `buildSpec()` in `specBuilder.ts`

### Adding a New Transform

1. Define type in `src/types/index.ts`:
```typescript
export interface TransformYourTransform {
  kind: 'yourTransform';
  param1: string;
  param2: number;
}

export type ChartTransform = ... | TransformYourTransform;
```

2. Add builder in `buildTransforms()` in `specBuilder.ts`

3. Add AI support in `nlPlanner.ts`

## Debugging

### Chart Not Rendering?

Check browser console for errors. Common issues:
- Invalid field names (check data fields match encodings)
- Missing required encodings (some marks need specific channels)
- Data format issues (check data is array of objects)

### AI Commands Not Working?

Enable debug logging in `nlPlanner.ts`:
```typescript
export function parseNLToPlan(...) {
  console.log('Input:', input);
  console.log('Operations:', ops);
  // ...
}
```

### Type Errors?

Run type checker:
```bash
npm run type-check
```

## Resources

- **Vega-Lite Examples**: https://vega.github.io/vega-lite/examples/
- **Vega Editor**: https://vega.github.io/editor/ (test specs)
- **Color Schemes**: https://vega.github.io/vega/docs/schemes/
- **Zustand Docs**: https://github.com/pmndrs/zustand

## Support

- Check `REQUIREMENTS.md` for full feature specifications
- See Vega-Lite docs for chart capabilities
- Open issues on GitHub for bugs/features

Happy charting! 🎉
