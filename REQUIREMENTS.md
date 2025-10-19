# Vega Chart Configuration Widget Framework - Requirements

## Overview
A modular widget framework that wraps Vega-Embed to provide intuitive, no-code chart configuration capabilities alongside an AI-powered natural language interface for regenerating chart specifications.

## Goals
- Enable non-technical users to configure Vega/Vega-Lite charts through visual controls
- Provide AI-assisted chart configuration via natural language commands
- Maintain spec validity and real-time preview
- Support progressive disclosure (simple → advanced controls)
- Enable embedding in any web application with minimal integration effort

## Architecture

### Core Components

#### 1. Widget Framework Core
```typescript
interface VegaWidgetConfig {
  containerId: string;
  initialSpec?: VegaSpec | VegaLiteSpec;
  data?: any[] | DataSource;
  mode?: 'vega' | 'vega-lite';
  features?: FeatureFlags;
  theme?: ThemeConfig;
  callbacks?: WidgetCallbacks;
}

interface FeatureFlags {
  enableAI?: boolean;
  enableSpecEditor?: boolean;
  enableDataEditor?: boolean;
  enableExport?: boolean;
  enableTemplates?: boolean;
  allowedMarks?: string[];
  allowedTransforms?: string[];
  maxDataRows?: number;
}

interface WidgetCallbacks {
  onSpecChange?: (spec: VegaSpec | VegaLiteSpec) => void;
  onDataChange?: (data: any[]) => void;
  onError?: (error: Error) => void;
  onExport?: (format: string, blob: Blob) => void;
  onAICommand?: (command: string, plan: ChartEditPlan) => void;
}
```

#### 2. Layout System
```
┌─────────────────────────────────────────────────────────────┐
│ Widget Container                                             │
├─────────────────────────────────────────────────────────────┤
│ ┌───────────────────┐  ┌───────────────────────────────┐   │
│ │  Control Panel    │  │   Chart Preview               │   │
│ │  ├─ Data Tab      │  │   ┌─────────────────────────┐ │   │
│ │  ├─ Mark Tab      │  │   │                         │ │   │
│ │  ├─ Encodings Tab │  │   │   Vega-Embed Render     │ │   │
│ │  ├─ Transform Tab │  │   │                         │ │   │
│ │  ├─ Style Tab     │  │   │                         │ │   │
│ │  ├─ AI Assistant  │  │   └─────────────────────────┘ │   │
│ │  └─ Spec Editor   │  │                               │   │
│ └───────────────────┘  └───────────────────────────────┘   │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Status Bar: Validation • Export • Templates • Undo/Redo │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Widget Panels

#### Data Panel
**Purpose**: Configure data source and preview

**Features**:
- Data source selector (inline JSON, URL, named dataset)
- Tabular data preview with pagination (first 100 rows)
- Field type inference and override
- Field statistics (min, max, unique count, nulls)
- Sample data generator for prototyping
- CSV/JSON upload

#### Mark Panel
**Purpose**: Select and configure mark type

**Features**:
- Visual mark selector (cards with icons)
  - Bar, Line, Area, Point, Circle, Square, Rect, Rule, Text, Tick
- Mark-specific properties:
  - Size, opacity, stroke, fill
  - Interpolation (line/area)
  - Stacking mode (bar/area)
  - Point overlay (line/area)
- Composite marks (boxplot, errorbar, errorband)

#### Encodings Panel
**Purpose**: Map data fields to visual channels

**Features**:
- Drag-and-drop field assignment to channels:
  - Positional: x, y, x2, y2
  - Mark properties: color, size, shape, opacity, stroke, strokeWidth
  - Text: text, tooltip
  - Faceting: row, column, facet
  - Order: order, detail
- Per-channel configuration:
  - Field selector (dropdown with field types)
  - Data type (Q, N, O, T)
  - Aggregate function (sum, mean, count, min, max, median, etc.)
  - Binning (checkbox + max bins)
  - Time unit (year, month, date, hours, etc.)
  - Sort (ascending, descending, by field)
  - Scale properties (domain, range, scheme, zero, reverse)
  - Axis/Legend properties (title, format, ticks, labels, grid)

#### Transform Panel
**Purpose**: Apply data transformations

**Features**:
- Transform pipeline builder (ordered list)
- Supported transforms:
  - **Filter**: Visual query builder + expression editor
  - **Calculate**: New field from expression
  - **Bin**: Numeric binning
  - **TimeUnit**: Temporal binning
  - **Aggregate**: Group-by aggregation
  - **Window**: Window functions (rank, row_number, lead, lag, etc.)
  - **Pivot/Fold**: Reshape data
  - **Impute**: Fill missing values
  - **Sample**: Random sampling
- Drag-to-reorder transforms
- Enable/disable individual transforms

#### Style Panel
**Purpose**: Configure chart aesthetics and layout

**Features**:
- **Size & Layout**:
  - Width, height (numeric or 'container')
  - Autosize mode (pad, fit, none)
  - Padding (top, bottom, left, right)
  - Background color
- **Axes**:
  - Per-axis: title, labels, ticks, grid, domain line
  - Label angle, font size, format
- **Legends**:
  - Position (right, left, top, bottom, none)
  - Title, labels, orientation
- **Colors**:
  - Categorical scheme picker (tableau10, category20, etc.)
  - Sequential/diverging scheme picker (viridis, blues, RdYlBu, etc.)
  - Custom domain/range mapping
- **Title**:
  - Text, subtitle
  - Font, size, color, anchor, offset

#### AI Assistant Panel
**Purpose**: Natural language chart editing

**Features**:
- **Command Input**:
  - Text input with autocomplete/suggestions
  - Quick action chips (common commands)
  - Command history dropdown
- **Plan Preview**:
  - Show parsed intent and confidence
  - List operations to be applied
  - "Apply" / "Cancel" buttons
- **Contextual Help**:
  - Suggested commands based on current chart state
  - Error explanations and fix suggestions

**Supported Intents**:
- Mark changes: "change to line chart", "switch to stacked bar"
- Encodings: "put Sales on Y axis", "color by Region", "bin Date by month"
- Series colors: "make West blue and East orange", "use viridis scheme"
- Aggregation: "sum Sales by Category", "average Profit"
- Sorting: "sort by Sales descending", "sort x axis alphabetically"
- Filtering: "show only Sales > 100", "exclude 2023 data"
- Top-N: "top 10 by Revenue", "bottom 5 products"
- Style: "remove gridlines", "set title to 'Q1 Sales'", "make chart 600px wide"

#### Spec Editor Panel
**Purpose**: Direct JSON editing for advanced users

**Features**:
- Monaco Editor integration
- Vega/Vega-Lite JSON schema validation
- Auto-completion for Vega keywords
- Syntax highlighting
- Format/prettify button
- Validation error markers with quick-fixes

### State Management

#### Spec Sync Strategy
```typescript
interface WidgetState {
  mode: 'builder' | 'spec' | 'hybrid';
  builderState: BuilderState;
  vegaSpec: VegaLiteSpec | VegaSpec;
  data: any[];
  history: StateSnapshot[];
  historyIndex: number;
  validationErrors: ValidationError[];
  aiContext: AIContext;
}

// Sync flow:
// 1. User changes Builder → regenerate spec → update preview
// 2. User edits spec → validate → try map to Builder (best-effort) → update preview
// 3. AI command → update Builder → regenerate spec → update preview
// 4. Undo/redo → restore StateSnapshot → sync Builder/Spec → update preview
```

### Component Architecture

```typescript
// Widget entry point
class VegaConfigWidget {
  constructor(config: VegaWidgetConfig);

  // State
  getSpec(): VegaLiteSpec | VegaSpec;
  setSpec(spec: VegaLiteSpec | VegaSpec): void;
  getData(): any[];
  setData(data: any[]): void;
  getBuilderState(): BuilderState;
  setBuilderState(state: BuilderState): void;

  // Actions
  applyCommand(nlCommand: string): Promise<void>;
  undo(): void;
  redo(): void;
  reset(): void;
  export(format: 'png' | 'svg' | 'pdf' | 'json' | 'html'): Promise<Blob>;
}

// Internal modules
- DataPanel (React component)
- MarkPanel (React component)
- EncodingsPanel (React component)
- TransformPanel (React component)
- StylePanel (React component)
- AIPanel (React component)
- SpecEditorPanel (React component)
- ChartPreview (Vega-Embed wrapper)
- StateManager (Zustand store)
- SpecBuilder (BuilderState → VegaLiteSpec)
- SpecParser (VegaLiteSpec → BuilderState)
- Validator (AJV + Vega runtime)
- AIService (LLM integration)
- ExportService (Vega-Embed export)
```

### React Integration
```tsx
import { VegaConfigWidget } from '@vega-config-widget/react';

function MyApp() {
  const [spec, setSpec] = useState(initialSpec);

  return (
    <VegaConfigWidget
      spec={spec}
      data={data}
      onSpecChange={setSpec}
      features={{ enableAI: true }}
    />
  );
}
```

## Technical Stack

### Frontend
- **Framework**: React 18+
- **State**: Zustand for widget state
- **UI Components**: shadcn/ui or custom components
- **Code Editor**: Monaco Editor
- **Validation**: AJV for JSON Schema
- **Charting**: Vega-Embed (vega, vega-lite)
- **Styling**: TailwindCSS
- **Build**: Vite

### AI Integration
- **LLM Client**: OpenAI SDK or Anthropic SDK
- **Prompt Management**: Few-shot examples library
- **Caching**: Cache parsed plans for common commands

### Testing
- **Unit**: Vitest
- **E2E**: Playwright
- **Accessibility**: axe-core

## MVP Scope (Phase 1)

### Core Features
1. **Data Panel**: Load inline JSON data, field preview
2. **Mark Panel**: Basic mark selection (bar, line, area, point)
3. **Encodings Panel**: X, Y, Color channels with field selection, type, aggregate
4. **Chart Preview**: Real-time Vega-Lite rendering
5. **AI Assistant**: Basic NL commands (mark change, color by field, top-N, series colors)
6. **State Management**: Builder ↔ Spec sync, basic validation

### Out of Scope (Future Phases)
- Transform Panel
- Style Panel (use defaults)
- Spec Editor
- Templates
- Export functionality (beyond Vega-Embed default)
- Data upload/URL loading
- Advanced encodings (faceting, multiple tooltips)
- Undo/Redo

## Success Metrics

- **Adoption**: Number of widgets embedded, active users
- **AI Usage**: Command success rate (applied without errors), confidence scores
- **Performance**: Spec generation < 100ms, render time < 1s for 10k points
- **Accessibility**: WCAG 2.1 AA compliance

## Future Enhancements

- **Data Connectors**: SQL, GraphQL, REST API
- **Advanced Interactions**: Brush & link, cross-filtering
- **Animations**: Smooth transitions between chart states
- **AI Insights**: Auto-generate insights from data
- **Custom Themes**: Theme builder UI
- **Plugin System**: Custom marks, transforms, panels
