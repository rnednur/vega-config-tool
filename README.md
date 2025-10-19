# Vega Chart Configuration Widget

A React-based widget framework for intuitively configuring Vega-Lite charts through visual controls and AI-powered natural language commands.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

The app will be available at http://localhost:5174/

## ✨ Features

### MVP (Current Implementation)

- **Visual Chart Builder**
  - Mark selection panel (bar, line, area, point, etc.)
  - Encoding configuration (x, y, color, size)
  - Field type inference and override
  - Real-time chart preview with Vega-Embed

- **AI Assistant**
  - Natural language commands to modify charts
  - Examples:
    - "change to line chart"
    - "color by Region"
    - "top 10 by Sales"
    - "make West blue and East orange"
    - "sort by Sales descending"
    - "use viridis color scheme"
  - Command parsing with confidence scores
  - Quick command suggestions

- **State Management**
  - Undo/Redo functionality (Cmd/Ctrl+Z)
  - History tracking with snapshots
  - Automatic spec regeneration

- **Data Handling**
  - Field type inference (quantitative, nominal, ordinal, temporal)
  - Field statistics calculation
  - Support for JSON data

## 📁 Project Structure

```
src/
├── components/
│   ├── VegaConfigWidget.tsx    # Main widget component
│   ├── ChartPreview.tsx         # Vega-Embed wrapper
│   └── panels/
│       ├── MarkPanel.tsx        # Mark type selection
│       ├── EncodingsPanel.tsx   # Encoding configuration
│       └── AIPanel.tsx          # Natural language interface
├── store/
│   └── widgetStore.ts           # Zustand state management
├── types/
│   └── index.ts                 # TypeScript type definitions
└── utils/
    ├── fieldInference.ts        # Field type inference
    ├── specBuilder.ts           # Builder state → Vega-Lite spec
    └── nlPlanner.ts             # Natural language parser
```

## 🎯 Usage

### Basic Usage

```tsx
import { VegaConfigWidget } from './components/VegaConfigWidget';

const data = [
  { Category: 'A', Sales: 120, Region: 'West' },
  { Category: 'B', Sales: 90, Region: 'East' },
];

function App() {
  return (
    <VegaConfigWidget
      data={data}
      builderState={{
        mark: { type: 'bar', stacked: null },
        encodings: {
          x: { field: 'Category', type: 'nominal' },
          y: { field: 'Sales', type: 'quantitative', aggregate: 'sum' },
        },
      }}
      callbacks={{
        onSpecChange: (spec) => console.log('Spec:', spec),
      }}
    />
  );
}
```

### AI Commands

The AI Assistant supports various natural language commands:

**Mark Changes**
- "change to line chart"
- "switch to bar chart"
- "make it an area chart"

**Encodings**
- "color by Region"
- "use Sales for y axis"
- "put Category on x"

**Series Colors**
- "make West blue and East orange"
- "use viridis color scheme"

**Data Transformations**
- "top 10 by Sales"
- "sort by Sales descending"

**Styling**
- "set title to 'Q1 Sales'"

## 🏗️ Architecture

### State Flow

```
User Action (UI/AI)
    ↓
Update BuilderState
    ↓
Validate
    ↓
Regenerate Vega-Lite Spec
    ↓
Render with Vega-Embed
    ↓
Capture Snapshot (for undo/redo)
```

### Key Components

- **BuilderState**: High-level chart configuration (mark, encodings, transforms)
- **VegaSpec**: Generated Vega-Lite specification
- **WidgetStore**: Zustand store managing all state and actions
- **SpecBuilder**: Converts BuilderState to valid Vega-Lite spec
- **NLPlanner**: Parses natural language into structured operations

## 🔧 Configuration

### Widget Props

```typescript
interface VegaWidgetConfig {
  data?: any[];                    // Chart data
  builderState?: Partial<BuilderState>;  // Initial chart config
  features?: FeatureFlags;         // Feature toggles
  callbacks?: WidgetCallbacks;     // Event handlers
}

interface WidgetCallbacks {
  onSpecChange?: (spec: VisualizationSpec) => void;
  onDataChange?: (data: any[]) => void;
  onError?: (error: Error) => void;
  onAICommand?: (command: string, plan: ChartEditPlan) => void;
}
```

## 📋 Roadmap

### Phase 2 (Planned)
- Transform panel (filters, calculations, aggregations)
- Style panel (colors, axes, legends, sizing)
- Spec editor with Monaco
- Data upload (CSV, JSON)
- Export functionality (PNG, SVG, JSON)

### Phase 3 (Future)
- Templates library
- Advanced encodings (faceting, tooltips)
- LLM integration for complex AI commands
- Collaborative editing
- Plugin system

## 🧪 Development

```bash
# Type checking
npm run type-check

# Linting
npm run lint

# Build
npm run build
```

## 📚 References

- [Vega-Lite Documentation](https://vega.github.io/vega-lite/)
- [Vega-Embed](https://github.com/vega/vega-embed)
- [React Vega](https://github.com/vega/react-vega)
- [Zustand](https://github.com/pmndrs/zustand)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

### Third-Party Licenses

This software includes third-party libraries with the following licenses:

- **Vega, Vega-Lite, Vega-Embed**: BSD-3-Clause License
  Copyright (c) 2015-2023, University of Washington Interactive Data Lab

- **react-vega**: Apache-2.0 License

- **React, Zustand, jsPDF, and others**: MIT License

For complete license texts and attributions, see [THIRD_PARTY_LICENSES.txt](THIRD_PARTY_LICENSES.txt).

## 🤝 Contributing

See [REQUIREMENTS.md](./REQUIREMENTS.md) for detailed specifications and future enhancements.
