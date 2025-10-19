import type { VisualizationSpec } from 'vega-embed';

// ============================================================================
// Data Types
// ============================================================================

export type FieldType = 'quantitative' | 'nominal' | 'ordinal' | 'temporal';

export interface DataField {
  name: string;
  inferredType: FieldType;
  overrideType?: FieldType;
  format?: string;
  stats?: FieldStats;
}

export interface FieldStats {
  min?: number;
  max?: number;
  unique?: number;
  nulls?: number;
  topValues?: Array<{ value: any; count: number }>;
}

export interface DataSource {
  type: 'inline' | 'url' | 'named';
  value: any[] | string;
}

// ============================================================================
// Encoding Configuration
// ============================================================================

export type AggregateOp = 'sum' | 'mean' | 'median' | 'count' | 'min' | 'max' | 'distinct' | 'q1' | 'q3' | 'variance' | 'stdev';
export type TimeUnit = 'year' | 'month' | 'yearmonth' | 'date' | 'hours' | 'day' | 'yearmonthdate';
export type SortOrder = 'ascending' | 'descending';

export interface EncodingConfig {
  field?: string;
  type?: FieldType;
  aggregate?: AggregateOp;
  sort?: SortOrder | { field: string; order: SortOrder };
  scale?: ScaleConfig;
  timeUnit?: TimeUnit;
  bin?: boolean | { maxbins?: number };
  axis?: AxisConfig;
  legend?: LegendConfig;
}

export interface ScaleConfig {
  domain?: any[];
  range?: string[] | number[];
  scheme?: string;
  reverse?: boolean;
  zero?: boolean;
}

export interface AxisConfig {
  title?: string;
  format?: string;
  grid?: boolean;
  labelAngle?: number;
  labelFontSize?: number;
  titleFontSize?: number;
}

export interface LegendConfig {
  title?: string;
  orient?: 'left' | 'right' | 'top' | 'bottom' | 'none';
  labelFontSize?: number;
  titleFontSize?: number;
}

// ============================================================================
// Mark Configuration
// ============================================================================

export type MarkType = 'bar' | 'line' | 'area' | 'point' | 'circle' | 'square' | 'rect' | 'rule' | 'text' | 'tick';
export type StackMode = 'zero' | 'normalize' | null;

export interface MarkConfig {
  type: MarkType;
  point?: boolean; // For line/area marks
  stacked?: StackMode; // For bar/area marks
  opacity?: number;
  size?: number;
  strokeWidth?: number;
  interpolate?: 'linear' | 'step' | 'step-before' | 'step-after' | 'basis' | 'cardinal' | 'monotone';
}

// ============================================================================
// Transform Configuration
// ============================================================================

export interface TransformFilter {
  kind: 'filter';
  expr: string; // e.g., "datum.Sales > 100"
}

export interface TransformTopN {
  kind: 'topN';
  n: number;
  byField: string;
  order: SortOrder;
}

export interface TransformCalculate {
  kind: 'calculate';
  calculate: string;
  as: string;
}

export interface TransformAggregate {
  kind: 'aggregate';
  groupby?: string[];
  ops: AggregateOp[];
  fields: string[];
  as: string[];
}

export type ChartTransform = TransformFilter | TransformTopN | TransformCalculate | TransformAggregate;

// ============================================================================
// Builder State (Core State for UI)
// ============================================================================

export interface BuilderState {
  mark: MarkConfig;
  encodings: {
    x?: EncodingConfig;
    y?: EncodingConfig;
    color?: EncodingConfig;
    size?: EncodingConfig;
    tooltip?: EncodingConfig[] | 'auto' | 'none';
  };
  transforms: ChartTransform[];
  width?: number | 'container';
  height?: number | 'container';
  title?: string;
  description?: string;
  background?: string;
  padding?: number | { top?: number; bottom?: number; left?: number; right?: number };
}

// ============================================================================
// Widget Configuration
// ============================================================================

export interface FeatureFlags {
  enableAI?: boolean;
  enableSpecEditor?: boolean;
  enableDataEditor?: boolean;
  enableExport?: boolean;
  enableTemplates?: boolean;
  allowedMarks?: MarkType[];
  allowedTransforms?: ChartTransform['kind'][];
  maxDataRows?: number;
}

export interface WidgetCallbacks {
  onSpecChange?: (spec: VisualizationSpec) => void;
  onDataChange?: (data: any[]) => void;
  onError?: (error: Error) => void;
  onExport?: (format: string, blob: Blob) => void;
  onAICommand?: (command: string, plan: ChartEditPlan) => void;
}

export interface VegaWidgetConfig {
  initialSpec?: VisualizationSpec;
  data?: any[];
  features?: FeatureFlags;
  callbacks?: WidgetCallbacks;
  builderState?: Partial<BuilderState>;
}

// ============================================================================
// AI / Natural Language Types
// ============================================================================

export type Operation =
  | { op: 'set_mark'; mark: MarkType; options?: Partial<MarkConfig> }
  | { op: 'set_encoding'; channel: 'x' | 'y' | 'color' | 'size'; field: string; type?: FieldType; config?: Partial<EncodingConfig> }
  | { op: 'remove_encoding'; channel: 'x' | 'y' | 'color' | 'size' }
  | { op: 'set_series_colors'; colors: Record<string, string> }
  | { op: 'set_color_scheme'; scheme: string }
  | { op: 'set_top_n'; n: number; byField?: string; order?: SortOrder }
  | { op: 'set_sort'; channelOrField: 'x' | 'y' | string; by?: string; order: SortOrder }
  | { op: 'add_filter'; expr: string }
  | { op: 'set_aggregate'; channel: 'x' | 'y'; op: AggregateOp }
  | { op: 'set_title'; title: string }
  | { op: 'set_size'; width?: number | 'container'; height?: number | 'container' };

export interface ChartEditPlan {
  intentText: string;
  confidence?: number;
  operations: Operation[];
}

// ============================================================================
// Validation Types
// ============================================================================

export interface ValidationError {
  path: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

// ============================================================================
// State History (Undo/Redo)
// ============================================================================

export interface StateSnapshot {
  builderState: BuilderState;
  spec: VisualizationSpec;
  timestamp: number;
  description?: string;
}

// ============================================================================
// Widget Internal State
// ============================================================================

export type TabType = 'data' | 'mark' | 'encodings' | 'transforms' | 'style' | 'ai' | 'spec';

export interface WidgetState {
  // Core state
  builderState: BuilderState;
  vegaSpec: VisualizationSpec;
  data: any[];
  dataFields: DataField[];

  // UI state
  activeTab: TabType;
  validationErrors: ValidationError[];

  // History
  history: StateSnapshot[];
  historyIndex: number;

  // AI
  aiCommand: string;
  lastPlan: ChartEditPlan | null;
}
