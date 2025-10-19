# Integration Examples

## 1. Basic React App

```tsx
import { VegaConfigWidget } from './components/VegaConfigWidget';

function App() {
  const [data, setData] = useState([]);
  const [spec, setSpec] = useState(null);

  return (
    <div className="container">
      <VegaConfigWidget
        data={data}
        callbacks={{
          onSpecChange: (newSpec) => setSpec(newSpec),
        }}
      />
    </div>
  );
}
```

## 2. With API Data

```tsx
import { useEffect, useState } from 'react';
import { VegaConfigWidget } from './components/VegaConfigWidget';

function DashboardChart() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/sales-data')
      .then(res => res.json())
      .then(data => {
        setData(data);
        setLoading(false);
      });
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <VegaConfigWidget
      data={data}
      builderState={{
        mark: { type: 'bar', stacked: null },
        encodings: {
          x: { field: 'month', type: 'temporal' },
          y: { field: 'revenue', type: 'quantitative', aggregate: 'sum' },
          color: { field: 'region', type: 'nominal' },
        },
      }}
    />
  );
}
```

## 3. Controlled Component

```tsx
import { useState } from 'react';
import { VegaConfigWidget } from './components/VegaConfigWidget';
import type { BuilderState } from './types';

function ControlledChart() {
  const [builderState, setBuilderState] = useState<BuilderState>({
    mark: { type: 'line', stacked: null },
    encodings: {
      x: { field: 'date', type: 'temporal' },
      y: { field: 'value', type: 'quantitative' },
    },
    transforms: [],
  });

  const handleSave = (spec: any) => {
    // Save to backend
    fetch('/api/charts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spec, builderState }),
    });
  };

  return (
    <div>
      <VegaConfigWidget
        data={myData}
        builderState={builderState}
        callbacks={{
          onSpecChange: (spec) => handleSave(spec),
        }}
      />
    </div>
  );
}
```

## 4. Multiple Widgets in Dashboard

```tsx
function Dashboard() {
  const salesData = useSalesData();
  const inventoryData = useInventoryData();

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="border rounded p-4">
        <h2>Sales Trends</h2>
        <VegaConfigWidget
          data={salesData}
          builderState={{
            mark: { type: 'line' },
            encodings: {
              x: { field: 'date', type: 'temporal' },
              y: { field: 'sales', type: 'quantitative' },
            },
          }}
        />
      </div>

      <div className="border rounded p-4">
        <h2>Inventory Levels</h2>
        <VegaConfigWidget
          data={inventoryData}
          builderState={{
            mark: { type: 'bar' },
            encodings: {
              x: { field: 'product', type: 'nominal' },
              y: { field: 'quantity', type: 'quantitative' },
            },
          }}
        />
      </div>
    </div>
  );
}
```

## 5. With Feature Flags

```tsx
function EnterpriseChart() {
  return (
    <VegaConfigWidget
      data={data}
      features={{
        enableAI: true,           // Enable AI assistant
        enableSpecEditor: true,   // Enable JSON editor
        enableExport: true,       // Enable export buttons
        allowedMarks: ['bar', 'line', 'area'], // Restrict mark types
        maxDataRows: 10000,       // Limit data size
      }}
    />
  );
}
```

## 6. With Custom Callbacks

```tsx
function AnalyticsChart() {
  const handleAICommand = (command: string, plan: ChartEditPlan) => {
    // Log to analytics
    analytics.track('AI_Command_Used', {
      command,
      operations: plan.operations.length,
      confidence: plan.confidence,
    });
  };

  const handleError = (error: Error) => {
    // Error reporting
    errorReporter.captureException(error, {
      context: 'VegaConfigWidget',
    });
  };

  return (
    <VegaConfigWidget
      data={data}
      callbacks={{
        onSpecChange: (spec) => console.log('Spec:', spec),
        onDataChange: (data) => console.log('Data:', data),
        onError: handleError,
        onAICommand: handleAICommand,
      }}
    />
  );
}
```

## 7. Embedding in Different Frameworks

### Next.js

```tsx
// app/charts/page.tsx
'use client';

import dynamic from 'next/dynamic';

const VegaConfigWidget = dynamic(
  () => import('@/components/VegaConfigWidget').then(mod => ({ default: mod.VegaConfigWidget })),
  { ssr: false }
);

export default function ChartsPage() {
  return <VegaConfigWidget data={data} />;
}
```

### Remix

```tsx
// app/routes/charts.tsx
import { json } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { VegaConfigWidget } from '~/components/VegaConfigWidget';

export const loader = async () => {
  const data = await fetchChartData();
  return json({ data });
};

export default function Charts() {
  const { data } = useLoaderData<typeof loader>();

  return <VegaConfigWidget data={data} />;
}
```

### Svelte (via Web Component wrapper)

```svelte
<!-- Chart.svelte -->
<script>
  import { onMount } from 'svelte';

  export let data = [];
  let container;

  onMount(() => {
    // You'd need to create a web component wrapper
    const widget = new VegaConfigWidgetElement();
    widget.data = data;
    container.appendChild(widget);
  });
</script>

<div bind:this={container}></div>
```

## 8. Programmatic Control

```tsx
import { useRef } from 'react';
import { useWidgetStore } from './store/widgetStore';

function ProgrammaticControl() {
  const applyCommand = useWidgetStore(state => state.applyCommand);
  const setBuilderState = useWidgetStore(state => state.setBuilderState);
  const undo = useWidgetStore(state => state.undo);
  const redo = useWidgetStore(state => state.redo);

  const handlePreset1 = () => {
    setBuilderState({
      mark: { type: 'bar', stacked: 'zero' },
      encodings: {
        x: { field: 'category', type: 'nominal' },
        y: { field: 'value', type: 'quantitative', aggregate: 'sum' },
        color: { field: 'region', type: 'nominal' },
      },
    });
  };

  const handleAIPreset = async () => {
    // Programmatically execute AI command
    await applyCommand('change to line chart and color by region');
  };

  return (
    <div>
      <div className="controls">
        <button onClick={handlePreset1}>Stacked Bar Chart</button>
        <button onClick={handleAIPreset}>Line Chart by Region</button>
        <button onClick={undo}>Undo</button>
        <button onClick={redo}>Redo</button>
      </div>
      <VegaConfigWidget data={data} />
    </div>
  );
}
```

## 9. Custom Styling

```tsx
function StyledChart() {
  return (
    <div className="custom-theme">
      <style>{`
        .custom-theme .vega-config-widget {
          --primary-color: #6366f1;
          --border-color: #e5e7eb;
          --background: #ffffff;
          font-family: 'Inter', sans-serif;
        }

        .custom-theme button {
          border-radius: 0.5rem;
          transition: all 0.2s;
        }

        .custom-theme button:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
      `}</style>

      <VegaConfigWidget data={data} />
    </div>
  );
}
```

## 10. Export and Share

```tsx
function ShareableChart() {
  const [shareUrl, setShareUrl] = useState('');

  const handleShare = async (spec: any) => {
    // Save spec to backend and get shareable URL
    const response = await fetch('/api/charts/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spec }),
    });

    const { url } = await response.json();
    setShareUrl(url);
  };

  const handleExport = async () => {
    const spec = useWidgetStore.getState().vegaSpec;

    // Export as PNG
    const blob = await exportToPNG(spec);
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'chart.png';
    a.click();
  };

  return (
    <div>
      <VegaConfigWidget
        data={data}
        callbacks={{
          onSpecChange: handleShare,
        }}
      />

      {shareUrl && (
        <div className="mt-4">
          <p>Share this chart:</p>
          <input
            readOnly
            value={shareUrl}
            className="w-full p-2 border rounded"
          />
        </div>
      )}

      <button onClick={handleExport}>Export as PNG</button>
    </div>
  );
}
```

## Best Practices

1. **Always provide data** - The widget needs data to infer field types
2. **Use controlled state when needed** - For complex apps, manage builderState externally
3. **Handle errors gracefully** - Use the onError callback
4. **Debounce expensive operations** - If saving to backend, debounce onSpecChange
5. **Memoize data** - Use useMemo for data transformations to avoid re-renders
6. **Feature flags for production** - Disable experimental features in production
7. **Test with real data** - Use production-like data volumes for testing
8. **Monitor AI usage** - Track AI command success rates and user patterns

## Troubleshooting

**Widget not rendering:**
- Check that container has explicit height/width
- Verify data is array of objects
- Check browser console for errors

**AI commands not working:**
- Ensure field names in command match actual data fields
- Check nlPlanner.ts for supported patterns
- Verify data fields are correctly inferred

**Performance issues:**
- Limit data rows (use features.maxDataRows)
- Debounce rapid state changes
- Use React.memo for expensive components
- Consider virtualization for large datasets

**Type errors:**
- Run `npm run type-check`
- Ensure BuilderState matches your requirements
- Check that callbacks have correct signatures
